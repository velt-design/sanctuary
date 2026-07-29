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
    route: '/projects/warkworth-outdoor-room',
    expected: /freestanding gable room combining mixed roofing/i,
    retired: /keeps daylight moving through the space|bring natural light into the outdoor room/i,
  },
  {
    route: '/projects/mt-maunganui-box',
    expected: /first-floor box-perimeter pergola designed around the balustrade and outlook/i,
    retired: /soft filtered light|softens glare|soft, even light quality|reduce glare/i,
  },
  {
    route: '/projects/lilliput-mini-golf',
    expected: /pitched pergola supplied and installed within a consultant-led venue renovation/i,
    retired: /keep rain off|plenty of daylight|shedding water cleanly/i,
  },
  {
    route: '/projects/goodhome-commercial-terrace',
    expected: /two gables extending the villa-style facade/i,
    retired: /50 mm insulated|DMX|Heatstrip|blends seamlessly|part of the original structure/i,
  },
  {
    route: '/projects/kiwi-rail-platform',
    expected: /aluminium and acrylic canopy with integrated lighting along a workplace route/i,
    retired: /pantograph|ColorCote|EN 12464|service platform|stay dry|dry, well-lit|safe and inviting/i,
  },
  {
    route: '/projects/tindalls-bay-pavilion',
    expected: /patio and carport using insulated and acrylic roof zones/i,
    retired: /twinwall polycarbonate|Somfy RTS|wind\/rain sensors|daylight can flood|wind protection|bright but protected/i,
  },
  {
    route: '/projects/atelier-shu-cafe',
    expected: /dark-tint acrylic gable canopy aligned with the cafe frontage/i,
    retired: /laminated glass|acoustic interlayer|frameless sliding|feels like it has always been there|changes the shade and light character/i,
  },
  {
    route: '/projects/muriwai-courtyard',
    expected: /opal-acrylic hip roof replacing the previous courtyard pergola/i,
    retired: /cedar soffit|fireplace fan|projector cabling|bright, sheltered outdoor room|diffusing daylight/i,
  },
  {
    route: '/projects/waiheke-holiday-home',
    expected: /box-perimeter deck cover designed to preserve the water view/i,
    retired: /Somfy RTS|infrared heaters|insulated aluminium roof/i,
  },
  {
    route: '/projects/velskov-forest',
    expected: /low-profile shelter for a working space beneath the forest canopy/i,
    retired: /dry, usable space for farm activity/i,
  },
  {
    route: '/projects/ardmore-box-carport',
    expected: /box-perimeter carport with acrylic roofing and an internal gable/i,
    retired: /strong weather protection|providing weather cover|keeping the space bright/i,
  },
  {
    route: '/projects/riverhead-gable-pavilion',
    expected: /poolside gable pavilion with timber lining and integrated lighting/i,
    retired: /all-season|proper weather protection|improves comfort|comfortable covered lounge/i,
  },
  {
    route: '/projects/st-heliers-townhouse',
    expected: /open gable with opal acrylic and a custom street-facing frame/i,
    retired: /keep the patio bright while cutting glare/i,
  },
  {
    route: '/projects/dairy-flat-estate',
    expected: /aluminium and acrylic gable following the existing roofline/i,
    retired: /maximum light|shelter from wind and rain|bright and sheltered/i,
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
    await expect(main.locator('.acrylic-section--final-cta')).toHaveCount(0);
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
  await expect(acrylicPage.locator('details')).toHaveCount(5);

  await page.goto('/acrylic-pergolas-vs-louvre-roofs');
  const louvreScopeAnswer = page.locator('.acrylic-faq-list > details', {
    hasText: 'Does Sanctuary install louvre roofs?',
  });
  await louvreScopeAnswer.locator('summary').click();
  const comparisonCopy = await page.locator('main[data-marketing-foundation-page]').innerText();
  expect(comparisonCopy).toContain("Sanctuary's published roof offer is fixed acrylic, solid and combination roofs.");
  expect(comparisonCopy).toContain('not a Sanctuary product.');
});

test('linked project pages use the current evidence record rather than contradictory legacy detail', async ({ page }) => {
  await preparePage(page);
  for (const project of projectEvidence) {
    await page.goto(project.route);
    const main = page.locator('main[data-projects-experience]:visible').last();
    await expect(main).toBeVisible();
    const copy = await main.innerText();
    expect(copy, `${project.route} should expose the current project evidence`).toMatch(project.expected);
    expect(copy, `${project.route} should not expose retired legacy detail`).not.toMatch(project.retired);
  }
});

test('dependent guide snippets keep project outcomes tied to the recorded design response', async ({ page }) => {
  await preparePage(page);
  for (const snippet of [
    {
      route: '/acrylic-pergolas-vs-louvre-roofs',
      expected: /infilled end and open garden side/i,
      retired: /keeping the outdoor area bright/i,
    },
    {
      route: '/gable-pergolas-auckland',
      expected: /infilled end and open garden side/i,
      retired: /adding shelter while retaining the garden connection/i,
    },
    {
      route: '/pergolas-with-blinds',
      expected: /identified in the project brief for wind and privacy/i,
      retired: /to address wind and privacy while retaining the coastal view/i,
    },
  ] as const) {
    await page.goto(snippet.route);
    const copy = await page.locator('main[data-marketing-foundation-page]').innerText();
    expect(copy, `${snippet.route} should use the qualified project snippet`).toMatch(snippet.expected);
    expect(copy, `${snippet.route} should not repeat the retired outcome`).not.toMatch(snippet.retired);
  }
});

test('homepage design conversation uses written project context instead of unsupported scores', async ({ page }) => {
  await preparePage(page);
  await page.goto('/');
  const conversation = page.locator(
    'main[data-homepage-variant="design_conversation_home_v3"]:visible section[aria-labelledby="design-conversation-heading"]',
  );
  await expect(conversation).toBeVisible();
  await expect(conversation.getByText(
    'Starting points only.',
  )).toBeVisible();
  await conversation.getByRole('radio', {
    name: /Cover a deck/,
  }).click();
  await expect(conversation.getByText(
    'Start with the house connection, daylight and how the deck should work.',
  )).toBeVisible();
  await expect(conversation.getByText(
    'An acrylic gable follows the roofline with one infilled end.',
  )).toBeVisible();
  await expect(conversation.getByText(
    'A box-perimeter cover follows the first-floor deck and outlook.',
  )).toBeVisible();
  await expect(conversation.getByText(/\b[1-5]\s*\/\s*5\b/)).toHaveCount(0);
  const copy = await page.locator('body').innerText();
  expect(copy).not.toMatch(/Strong heat and glare reduction, noticeably softer rain noise/i);
  expect(copy).not.toMatch(/bright acrylic gable|soft daylight/i);
});
