import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const route = '/pergolas-auckland';
const title = 'Pergolas Auckland | Design, Build & Installation';
const description = 'Plan an Auckland pergola around the home, outdoor area and intended use. Compare roof forms, materials and project scope, then share the site for an initial assessment.';
const capturePhase = process.env.MARKETING_SEO_CAPTURE_PHASE?.trim();
const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-seo-landing', 'pergolas-auckland');
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

function wordShingles(text: string, size = 10): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return new Set(words.slice(0, Math.max(0, words.length - size + 1)).map((_, index) => words.slice(index, index + size).join(' ')));
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  const intersection = [...left].filter((item) => right.has(item)).length;
  return intersection / (left.size + right.size - intersection || 1);
}

for (const viewport of viewports) {
  test(`Pergolas Auckland is publish-ready at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await page.goto(route);
    const main = page.locator('main[data-seo-landing="pergolas-auckland"]');

    await expect(page).toHaveTitle(title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${route}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
    await expect(main).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Pergolas for Auckland homes, designed from the house out' })).toBeVisible();
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(page.locator('header.site')).toBeVisible();
    await expect(page.locator('footer')).toBeAttached();
    await expect(page.getByLabel('Phone', { exact: false })).toHaveAttribute('required', '');
    await expect(page.locator('#acrylic-enquiry-style')).toHaveValue('');
    await expect(page.locator('#acrylic-enquiry-roof')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Send my project details' })).toBeVisible();
    await expect(main.locator('.acrylic-project-card img')).toHaveCount(4);
    await expect(main.locator('details')).toHaveCount(7);
    await expect(main.getByRole('navigation', { name: 'Pergola guide progression' })).toBeVisible();
    await expect(main.getByText('Editorial review: Sanctuary Pergolas')).toBeVisible();
    await expect(main.locator('time[datetime="2026-07-22"]')).toHaveText('22 July 2026');
    await expect(main.locator('.seo-landing__project-facts')).toHaveCount(4);

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
      await expect(page.getByRole('link', { name: 'Quick Estimate' })).toBeVisible();
    }

    if (viewport.width <= 720) {
      await expect(page.getByRole('link', { name: 'Send project details', exact: true })).toBeVisible();
    }

    if (capturePhase) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-top.png`) });
      await main.getByRole('navigation', { name: 'Pergola guide progression' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-navigation.png`) });
      await page.locator('#project-evidence').scrollIntoViewIfNeeded();
      await page.locator('.acrylic-project-card img').first().scrollIntoViewIfNeeded();
      await expect.poll(() => page.locator('.acrylic-project-card img').first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-proof.png`) });
      await page.locator('#roof-material-effect').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-options.png`) });
      await page.locator('#estimate-form-title').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-form.png`) });
    }
  });
}

test('Pergolas Auckland keeps its narrative distinct from the acrylic landing page', async ({ page }) => {
  await preparePage(page);
  await page.goto(route);
  const broadCopy = await page.locator('main[data-seo-landing="pergolas-auckland"]').innerText();
  const broadHeadings = await page.locator('main[data-seo-landing="pergolas-auckland"] h1, main[data-seo-landing="pergolas-auckland"] h2').allTextContents();

  await page.goto('/acrylic-roof-pergolas-auckland-v2');
  const acrylicCopy = await page.locator('main[data-copy-variant="context-pack-v2"]').innerText();
  const acrylicHeadings = await page.locator('main[data-copy-variant="context-pack-v2"] h1, main[data-copy-variant="context-pack-v2"] h2').allTextContents();

  expect(broadHeadings.filter((heading) => acrylicHeadings.includes(heading))).toEqual([]);
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

  await page.locator('#acrylic-enquiry-message').fill('We need a sheltered dining area but want to keep the kitchen bright.');
  await page.getByRole('button', { name: 'Send my project details' }).click();
  await expect(page.getByText('Choose an enquiry type.')).toBeVisible();

  await page.locator('#acrylic-enquiry-type').selectOption('residential');
  await page.locator('#acrylic-enquiry-name').fill('Test Person');
  await page.locator('#acrylic-enquiry-phone').fill('021 000 0000');
  await page.locator('#acrylic-enquiry-email').fill('test@example.com');
  await page.locator('#acrylic-enquiry-suburb').fill('Auckland');
  await page.locator('#acrylic-enquiry-roof').selectOption('Combination roofing');
  await page.getByRole('button', { name: 'Send my project details' }).click();

  await expect(page.getByText('Thanks, we have received your project details.')).toBeVisible();
  expect(submittedBody).toMatchObject({
    page: route,
    source: 'website',
    roofMaterials: ['acrylic', 'timber'],
    projectDetails: { roofPreference: 'Combination roofing' },
  });
});

test('Pergolas Auckland sitemap, internal links and page schema match the service role', async ({ page, request }) => {
  await preparePage(page);
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).toContainText(route);

  await page.goto(route);
  const main = page.locator('main[data-seo-landing="pergolas-auckland"]');
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
    const main = page.locator('main[data-seo-landing="custom-pergolas-auckland"]');

    await expect(page).toHaveTitle(customTitle);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${customRoute}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', customDescription);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
    await expect(page.getByRole('heading', { level: 1, name: 'Custom pergolas for sites where the obvious answer does not fit' })).toBeVisible();
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.locator('.acrylic-project-card img')).toHaveCount(4);
    await expect(main.locator('details')).toHaveCount(6);
    await expect(main.getByRole('navigation', { name: 'Pergola guide progression' })).toBeVisible();
    await expect(main.getByText('Editorial review: Sanctuary Pergolas')).toBeVisible();
    await expect(main.locator('time[datetime="2026-07-22"]')).toHaveText('22 July 2026');
    await expect(main.locator('.seo-landing__project-facts')).toHaveCount(4);
    await expect(page.locator('#acrylic-enquiry-knownConstraints')).toBeVisible();
    await expect(page.locator('#acrylic-enquiry-style')).toHaveValue('');
    await expect(page.locator('#acrylic-enquiry-roof')).toHaveValue('');

    const publicCopy = await main.innerText();
    expect(publicCopy).not.toContain('—');
    expect(publicCopy).not.toContain('[[VERIFY:');
    expect(publicCopy.toLowerCase()).not.toContain('bring your dream to life');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    if (viewport.width <= 900) {
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      await expect(page.locator('header.site .desktop-nav')).toBeHidden();
    } else {
      await expect(page.getByRole('link', { name: 'Quick Estimate' })).toBeVisible();
    }

    if (viewport.width <= 720) await expect(page.getByRole('link', { name: 'Request a design review', exact: true }).last()).toBeVisible();

    if (capturePhase) {
      await mkdir(customEvidenceDirectory, { recursive: true });
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-top.png`) });
      await main.getByRole('navigation', { name: 'Pergola guide progression' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-navigation.png`) });
      await page.locator('#custom-project-evidence').scrollIntoViewIfNeeded();
      await page.locator('.acrylic-project-card img').first().scrollIntoViewIfNeeded();
      await expect.poll(() => page.locator('.acrylic-project-card img').first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-proof.png`) });
      await page.locator('#custom-decisions-title').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-decisions.png`) });
      await page.locator('#custom-product-context').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-product-context.png`) });
      await page.locator('#estimate-form-title').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(customEvidenceDirectory, `page2-${viewport.name}-form.png`) });
    }
  });
}

test('Custom Pergolas Auckland is materially distinct from the broad pergola page', async ({ page }) => {
  await preparePage(page);
  await page.goto(customRoute);
  const customCopy = await page.locator('main[data-seo-landing="custom-pergolas-auckland"]').innerText();
  const customHeadings = await page.locator('main[data-seo-landing="custom-pergolas-auckland"] h1, main[data-seo-landing="custom-pergolas-auckland"] h2').allTextContents();
  await page.goto(route);
  const broadCopy = await page.locator('main[data-seo-landing="pergolas-auckland"]').innerText();
  const broadHeadings = await page.locator('main[data-seo-landing="pergolas-auckland"] h1, main[data-seo-landing="pergolas-auckland"] h2').allTextContents();

  expect(customHeadings.filter((heading) => broadHeadings.includes(heading))).toEqual([]);
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
  await page.locator('#acrylic-enquiry-type').selectOption('residential');
  await page.locator('#acrylic-enquiry-name').fill('Test Person');
  await page.locator('#acrylic-enquiry-phone').fill('021 000 0000');
  await page.locator('#acrylic-enquiry-email').fill('test@example.com');
  await page.locator('#acrylic-enquiry-suburb').fill('Auckland');
  await page.locator('#acrylic-enquiry-message').fill('The existing roofline and corner doors make a standard cover difficult.');
  await page.locator('#acrylic-enquiry-knownConstraints').fill('No post can sit across the corner door and the deck changes level.');
  await page.locator('#acrylic-enquiry-roof').selectOption('Acrylic roofing');
  await page.getByRole('button', { name: 'Request a design review' }).click();
  await expect(page.getByText('Thanks, we have received your project details.')).toBeVisible();
  expect(submittedBody).toMatchObject({ page: customRoute, source: 'website', roofMaterials: ['acrylic'], projectDetails: { roofPreference: 'Acrylic roofing', knownConstraints: 'No post can sit across the corner door and the deck changes level.' } });
});

test('Custom Pergolas Auckland sitemap, links and page schema match the service role', async ({ page, request }) => {
  await preparePage(page);
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).toContainText(customRoute);
  await page.goto(customRoute);
  const main = page.locator('main[data-seo-landing="custom-pergolas-auckland"]');
  const internalLinks = await main.locator('a[href^="/"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href) && !href.includes('#')))]);
  expect(internalLinks).toEqual(expect.arrayContaining([
    '/pergolas-auckland',
    '/pergola-cost-auckland',
    '/gable-pergolas-auckland',
    '/pitched-pergolas-auckland',
    '/outdoor-rooms-auckland',
    '/commercial-pergolas-auckland',
    '/products/pergolas/gable',
    '/products/pergolas/pitched',
    '/products/pergolas/box-perimeter',
  ]));
  for (const href of internalLinks) expect((await request.get(href)).status(), `${href} should resolve`).toBeLessThan(400);

  const jsonLdNodes = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((script) => { const parsed = JSON.parse(script) as unknown; return Array.isArray(parsed) ? parsed : [parsed]; }) as Array<{ '@type'?: string; dateModified?: string; reviewedBy?: { name?: string }; mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }> }>;
  expect(jsonLdNodes.find((node) => node['@type'] === 'Service')).toBeDefined();
  expect(jsonLdNodes.find((node) => node['@type'] === 'FAQPage')).toBeUndefined();
  expect(jsonLdNodes.find((node) => node['@type'] === 'BreadcrumbList')).toBeDefined();
  expect(jsonLdNodes.find((node) => node['@type'] === 'WebPage')).toMatchObject({ dateModified: '2026-07-22', reviewedBy: { name: 'Sanctuary Pergolas' } });
});
