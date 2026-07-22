import { expect, test, type Page } from '@playwright/test';

const guideRoutes = [
  '/pergolas-auckland',
  '/custom-pergolas-auckland',
  '/outdoor-rooms-auckland',
  '/commercial-pergolas-auckland',
  '/aluminium-pergolas-auckland',
  '/gable-pergolas-auckland',
  '/pitched-pergolas-auckland',
  '/pergola-cost-auckland',
  '/pergolas-with-blinds',
  '/acrylic-pergolas-vs-louvre-roofs',
] as const;

const refinedRoutes = [...guideRoutes, '/acrylic-roof-pergolas-auckland'] as const;

const internalPlanningLanguage = /\b(?:this|the)\s+(?:page|guide)\s+owns\b|\bpage\s+that\s+owns\b|\bowner\s+page\b|\bcluster\s+owner\b|\bkeyword\s+ownership\b|\bsearch\s+intent\b/i;

const projectEvidence = [
  {
    route: '/projects/goodhome-commercial-terrace',
    expected: /matched the 25° roof pitch/i,
    retired: /50 mm insulated|DMX|Heatstrip/i,
  },
  {
    route: '/projects/kiwi-rail-platform',
    expected: /covered pathway so staff can stay dry/i,
    retired: /pantograph|ColorCote|EN 12464|service platform/i,
  },
  {
    route: '/projects/tindalls-bay-pavilion',
    expected: /opal acrylic roofing with timber battens/i,
    retired: /twinwall polycarbonate|Somfy RTS|wind\/rain sensors/i,
  },
  {
    route: '/projects/atelier-shu-cafe',
    expected: /dark-tint acrylic roofing/i,
    retired: /laminated glass|acoustic interlayer|frameless sliding/i,
  },
  {
    route: '/projects/muriwai-courtyard',
    expected: /using opal acrylic roofing/i,
    retired: /cedar soffit|fireplace fan|projector cabling/i,
  },
  {
    route: '/projects/waiheke-holiday-home',
    expected: /hiding the 4° fall/i,
    retired: /Somfy RTS|infrared heaters|insulated aluminium roof/i,
  },
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

test('guide and product roles stay customer-facing, indexable and free of duplicate conversion UI', async ({ page }) => {
  await preparePage(page);
  const runtimeErrors: string[] = [];
  const identities: Array<{ title: string; description: string; h1: string }> = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  for (const route of refinedRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} should resolve directly`).toBe(200);
    const main = page.locator('main[data-marketing-foundation-page]');
    await expect(main).toBeVisible();
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.locator('form')).toHaveCount(1);
    await expect(main.locator('.acrylic-section--final-cta')).toHaveCount(1);
    await expect(main.locator('.acrylic-sticky-cta')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${route}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `https://www.sanctuarypergolas.co.nz${route}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /\S/);
    await expect(main.locator('img').first()).toHaveAttribute('alt', /\S/);

    const headingTexts = (await main.locator('h1, h2').allTextContents()).map((heading) => heading.trim()).filter(Boolean);
    expect(new Set(headingTexts).size, `${route} should not repeat visible H1 or H2 text`).toBe(headingTexts.length);
    identities.push({
      title: await page.title(),
      description: await page.locator('meta[name="description"]').getAttribute('content') ?? '',
      h1: await main.locator('h1').innerText(),
    });

    const publicCopy = await main.innerText();
    expect(publicCopy, `${route} should not expose internal planning language`).not.toMatch(internalPlanningLanguage);
    expect(publicCopy, `${route} should not mention the retired brochure`).not.toMatch(/Sanctuary-Pergolas-Brochure\.pdf/i);

    const schemaTypes = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((script) => {
      const parsed = JSON.parse(script) as Record<string, unknown> | Array<Record<string, unknown>>;
      return (Array.isArray(parsed) ? parsed : [parsed]).map((node) => node['@type']);
    });
    expect(schemaTypes, `${route} should use visible-page schema rather than FAQ rich-result markup`).not.toContain('FAQPage');
    expect(schemaTypes).toContain('WebPage');
    expect(schemaTypes).toContain('BreadcrumbList');
  }

  expect(new Set(identities.map((identity) => identity.title)).size).toBe(refinedRoutes.length);
  expect(new Set(identities.map((identity) => identity.description)).size).toBe(refinedRoutes.length);
  expect(new Set(identities.map((identity) => identity.h1)).size).toBe(refinedRoutes.length);
  expect(runtimeErrors).toEqual([]);
});

test('the acrylic page stays product-specific and the louvre comparison preserves Sanctuary fixed-roof positioning', async ({ page }) => {
  await preparePage(page);
  await page.goto('/acrylic-roof-pergolas-auckland');
  const acrylicPage = page.locator('main[data-marketing-foundation-page]');
  await expect(acrylicPage.getByRole('heading', { name: 'Name the exact fixed-roof assembly in the proposal' })).toBeVisible();
  await expect(acrylicPage.getByRole('link', { name: 'Compare fixed roofs with a louvre proposal' })).toHaveAttribute('href', '/acrylic-pergolas-vs-louvre-roofs');
  await expect(acrylicPage.getByRole('link', { name: 'Review scope and quote comparison' })).toHaveAttribute('href', '/pergola-cost-auckland');
  await expect(acrylicPage.getByRole('heading', { name: 'From initial enquiry to installation' })).toHaveCount(0);
  await expect(acrylicPage.getByRole('heading', { name: 'What affects the cost of an acrylic roof pergola?' })).toHaveCount(0);
  await expect(acrylicPage.locator('details')).toHaveCount(9);

  await page.goto('/acrylic-pergolas-vs-louvre-roofs');
  const louvreScopeAnswer = page.locator('details', { hasText: 'Does Sanctuary install louvre roofs?' });
  await louvreScopeAnswer.locator('summary').click();
  const comparisonCopy = await page.locator('main[data-marketing-foundation-page]').innerText();
  expect(comparisonCopy).toContain("Sanctuary's published roof offer is fixed acrylic, solid and combination roofs.");
  expect(comparisonCopy).toContain('The comparison does not present louvres as a Sanctuary product.');
});

test('linked project pages use the current evidence record rather than contradictory legacy detail', async ({ page }) => {
  await preparePage(page);
  for (const project of projectEvidence) {
    await page.goto(project.route);
    const copy = await page.locator('main[aria-label="Project detail"]').innerText();
    expect(copy, `${project.route} should expose the current project evidence`).toMatch(project.expected);
    expect(copy, `${project.route} should not expose retired legacy detail`).not.toMatch(project.retired);
  }
});

test('homepage roof comparison uses written considerations instead of unsupported scores', async ({ page }) => {
  await preparePage(page);
  await page.goto('/');
  const comparison = page.locator('.roof-comparison--editorial');
  await expect(comparison).toBeVisible();
  await expect(comparison.getByText('Depends on the exact clear, opal or tinted sheet and the roof composition.')).toBeVisible();
  await expect(comparison.getByText(/\b[1-5]\s*\/\s*5\b/)).toHaveCount(0);
  const copy = await page.locator('body').innerText();
  expect(copy).not.toMatch(/Strong heat and glare reduction, noticeably softer rain noise/i);
});
