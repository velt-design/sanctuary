import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

type ProgrammePage = {
  order: number;
  marker: string;
  route: string;
  title: string;
  description: string;
  h1: string;
  submitLabel: string;
  faqCount: number;
  role: 'service' | 'product-guide' | 'decision-guide';
  briefFieldName: string;
  projectCount: number;
  captureId: string;
  comparisonId: string;
  comparisonReferences: readonly string[];
};

const pages: ProgrammePage[] = [
  {
    order: 3,
    marker: 'aluminium-pergolas-auckland',
    route: '/aluminium-pergolas-auckland',
    title: 'Aluminium Pergolas Auckland | Frame & Finish Guide',
    description: 'Explore aluminium pergolas in Auckland. Understand frame proportion, roof integration, finish, structure and project scope before requesting a site-specific assessment.',
    h1: 'The frame sets the rhythm long before the roof is noticed',
    submitLabel: 'Send the project outline',
    faqCount: 8,
    role: 'product-guide',
    briefFieldName: 'openingPriorities',
    projectCount: 4,
    captureId: 'aluminium-projects',
    comparisonId: 'aluminium-specification-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 4,
    marker: 'pergola-cost-auckland',
    route: '/pergola-cost-auckland',
    title: 'Pergola Cost Auckland | Scope & Quote Guide',
    description: 'Understand pergola cost in Auckland without a misleading square-metre shortcut. See the real scope drivers, compare quotations and send details for an informed first assessment.',
    h1: 'A useful pergola price starts with a defined scope, not a square-metre guess',
    submitLabel: 'Request a scoped first look',
    faqCount: 10,
    role: 'decision-guide',
    briefFieldName: 'siteAccess',
    projectCount: 4,
    captureId: 'cost-projects',
    comparisonId: 'cost-drivers-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 5,
    marker: 'gable-pergolas-auckland',
    route: '/gable-pergolas-auckland',
    title: 'Gable Pergolas Auckland | Roof Form Guide',
    description: 'Explore gable pergolas in Auckland. Understand ridge height, pitch, gable ends, roofing, drainage and house integration before planning your project.',
    h1: 'A gable should borrow the home’s logic, not simply copy its pitch',
    submitLabel: 'Send the gable project',
    faqCount: 7,
    role: 'product-guide',
    briefFieldName: 'rooflineContext',
    projectCount: 4,
    captureId: 'gable-projects',
    comparisonId: 'gable-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 6,
    marker: 'pitched-pergolas-auckland',
    route: '/pitched-pergolas-auckland',
    title: 'Pitched Pergolas Auckland | Mono-Pitch Roof Guide',
    description: 'Explore pitched pergolas in Auckland. Plan the high edge, low edge, roof fall, daylight, drainage and house connection as one restrained roof form.',
    h1: 'One roof plane leaves nowhere for a weak line to hide',
    submitLabel: 'Send the pitched project',
    faqCount: 7,
    role: 'product-guide',
    briefFieldName: 'heightConstraints',
    projectCount: 4,
    captureId: 'pitched-projects',
    comparisonId: 'pitched-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 7,
    marker: 'outdoor-rooms-auckland',
    route: '/outdoor-rooms-auckland',
    title: 'Outdoor Rooms Auckland | Design & Installation',
    description: 'Plan an outdoor room in Auckland around dining, lounging, light, shelter and the home. Explore roof, edge, lighting and scope decisions with Sanctuary.',
    h1: 'Begin with the life inside the room, not the roof above it',
    submitLabel: 'Describe the room you need',
    faqCount: 8,
    role: 'service',
    briefFieldName: 'furnitureAndUse',
    projectCount: 4,
    captureId: 'outdoor-room-projects',
    comparisonId: 'outdoor-room-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 8,
    marker: 'pergolas-with-blinds',
    route: '/pergolas-with-blinds',
    title: 'Pergolas With Blinds Auckland | Integrated Outdoor Screens',
    description: 'Plan a pergola with blinds in Auckland around wind direction, low sun, privacy and open views. Explore blind integration, controls, scope and project evidence.',
    h1: 'A blind works best when the edge was designed to receive it',
    submitLabel: 'Describe the exposed edge',
    faqCount: 9,
    role: 'product-guide',
    briefFieldName: 'edgeCondition',
    projectCount: 3,
    captureId: 'blind-projects',
    comparisonId: 'blind-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 9,
    marker: 'acrylic-pergolas-vs-louvre-roofs',
    route: '/acrylic-pergolas-vs-louvre-roofs',
    title: 'Acrylic Pergolas vs Louvre Roofs | Auckland Guide',
    description: 'Compare acrylic pergolas and louvre roof proposals by roof behaviour, daylight, shade, rain detailing, controls, maintenance evidence and complete installed scope.',
    h1: 'Choose the roof behaviour before choosing the roof label',
    submitLabel: 'Compare your roof brief',
    faqCount: 8,
    role: 'decision-guide',
    briefFieldName: 'roofStates',
    projectCount: 4,
    captureId: 'acrylic-comparison-projects',
    comparisonId: 'roof-comparison-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 10,
    marker: 'commercial-pergolas-auckland',
    route: '/commercial-pergolas-auckland',
    title: 'Commercial Pergolas Auckland | Design & Build',
    description: 'Sanctuary designs and builds commercial pergolas in Auckland, coordinating engineering, consent and trades where required from venue brief to installation.',
    h1: 'You run the venue. We manage the pergola project.',
    submitLabel: 'Discuss your venue',
    faqCount: 8,
    role: 'service',
    briefFieldName: 'operatingConstraints',
    projectCount: 4,
    captureId: 'commercial-projects',
    comparisonId: 'commercial-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds', '/acrylic-pergolas-vs-louvre-roofs', '/acrylic-roof-pergolas-auckland-v2'],
  },
];

const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];
const capturePhase = process.env.MARKETING_SEO_PROGRAMME_CAPTURE_PHASE?.trim();
const phaseOneCapture = process.env.MARKETING_PHASE_ONE_CAPTURE === '1';
const phaseOneEvidenceDirectory = path.join(process.cwd(), 'artifacts', 'mobile-ux-phase-1');

async function preparePage(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
}

function wordShingles(text: string, size = 10): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return new Set(words.slice(0, Math.max(0, words.length - size + 1)).map((_, index) => words.slice(index, index + size).join(' ')));
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  const intersection = [...left].filter((item) => right.has(item)).length;
  return intersection / (left.size + right.size - intersection || 1);
}

for (const programmePage of pages) {
  for (const viewport of viewports) {
    test(`Page ${programmePage.order} ${programmePage.marker} is publish-ready at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await preparePage(page);
      await page.goto(programmePage.route);
      const main = page.locator(`main[data-seo-landing="${programmePage.marker}"]:visible`);

      await expect(page).toHaveTitle(programmePage.title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${programmePage.route}`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', programmePage.description);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
      await expect(page.getByRole('heading', { level: 1, name: programmePage.h1 })).toBeVisible();
      await expect(main.locator('h1')).toHaveCount(1);
      await expect(main.locator('.acrylic-project-card img')).toHaveCount(programmePage.projectCount);
      await expect(main.locator('.acrylic-faq-list > details')).toHaveCount(programmePage.faqCount);
      await expect(main.getByRole('navigation', { name: 'Pergola guide progression' })).toBeVisible();
      await expect(main.getByText('Editorial review: Sanctuary Pergolas')).toBeVisible();
      await expect(main.locator('time[datetime="2026-07-22"]')).toHaveText('22 July 2026');
      await expect(main.locator('.seo-landing__project-facts')).toHaveCount(programmePage.projectCount);
      await expect(main.locator(`#acrylic-enquiry-${programmePage.briefFieldName}`)).toBeVisible();
      await expect(main.locator('#acrylic-enquiry-type')).toHaveValue(
        programmePage.marker === 'commercial-pergolas-auckland'
          ? 'commercial'
          : 'residential',
      );
      await expect(main.locator('#acrylic-enquiry-style')).toHaveValue('');
      await expect(main.locator('#acrylic-enquiry-roof')).toHaveValue('');
      const copy = await main.innerText();
      expect(copy).not.toContain('—');
      expect(copy).not.toContain('[[VERIFY:');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      if (programmePage.marker === 'commercial-pergolas-auckland') {
        await expect(main.getByText('Designed in-house', { exact: true })).toBeVisible();
        await expect(main.getByText('Engineering, consent and trades coordinated', { exact: true })).toBeVisible();
        await expect(main.getByRole('heading', { level: 2, name: 'From the first venue conversation to the installed project' })).toBeVisible();
        await expect(main.getByRole('heading', { level: 3, name: 'Coordinate engineering and consent' })).toBeVisible();
        await expect(main.getByRole('heading', { level: 3, name: 'Build, install and hand over' })).toBeVisible();
        const planningSupport = main.locator(
          'details[data-seo-landing-disclosure="commercial-planning-support"]',
        );
        if (viewport.width <= 720) {
          await planningSupport.locator(':scope > summary').click();
        }
        const consentFaq = main.locator('.acrylic-faq-list > details').filter({
          hasText: 'Can Sanctuary coordinate engineering and building consent?',
        });
        await consentFaq.locator(':scope > summary').click();
        await expect(consentFaq.getByText('The relevant authority remains responsible for its decision.')).toBeVisible();
        await expect(main.getByRole('heading', { level: 2, name: 'Show us the venue and what the space needs to do' })).toBeVisible();
        await expect(main.locator('#commercial-projects .acrylic-project-card h3')).toHaveText([
          'The Good Home Takanini',
          'Atelier Shu Cafe',
          'Lilliput Mini Golf',
          'KiwiRail Head Office',
        ]);
      }

      if (viewport.width <= 900) {
        await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
        await expect(page.locator('header.site .desktop-nav')).toBeHidden();
      } else await expect(page.getByRole('link', { name: 'Get an estimate' })).toBeVisible();

      if (capturePhase) {
        const directory = path.join(process.cwd(), 'artifacts', 'marketing-seo-landing', programmePage.marker);
        await mkdir(directory, { recursive: true });
        await page.evaluate(() => {
          document.scrollingElement?.scrollTo({ top: 0, behavior: 'instant' });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        });
        await expect.poll(() => page.evaluate(() => document.scrollingElement?.scrollTop ?? window.scrollY)).toBe(0);
        await page.screenshot({ path: path.join(directory, `${capturePhase}-${viewport.name}-top.png`) });
        await main.locator(`#${programmePage.captureId}`).scrollIntoViewIfNeeded();
        if (programmePage.projectCount) {
          await expect.poll(() => main.locator('.acrylic-project-card img').evaluateAll((images) => images.filter((image) => (image as HTMLImageElement).naturalWidth > 0).length)).toBe(programmePage.projectCount);
        }
        await page.screenshot({ path: path.join(directory, `${capturePhase}-${viewport.name}-proof.png`) });
        await main.locator(`#${programmePage.comparisonId}`).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, `${capturePhase}-${viewport.name}-decisions.png`) });
        await main.locator('#estimate-form-title').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, `${capturePhase}-${viewport.name}-form.png`) });
      }
    });
  }

  test(`Page ${programmePage.order} ${programmePage.marker} is original against earlier references`, async ({ page }) => {
    await preparePage(page);
    await page.goto(programmePage.route);
    const currentMain = page.locator(`main[data-seo-landing="${programmePage.marker}"]:visible`);
    const currentCopy = await currentMain.innerText();
    const currentHeadings = await currentMain.locator('h1, h2').allTextContents();
    for (const reference of programmePage.comparisonReferences) {
      await page.goto(reference);
      const referenceMain = page.locator('main.acrylic-landing:visible');
      const referenceCopy = await referenceMain.innerText();
      const referenceHeadings = await referenceMain.locator('h1, h2').allTextContents();
      expect(currentHeadings.filter((heading) => referenceHeadings.includes(heading)), `${programmePage.route} repeats a heading from ${reference}`).toEqual([]);
      expect(jaccardSimilarity(wordShingles(currentCopy), wordShingles(referenceCopy)), `${programmePage.route} is too similar to ${reference}`).toBeLessThan(0.14);
    }
  });

  test(`Page ${programmePage.order} ${programmePage.marker} enquiry keeps route attribution`, async ({ page }) => {
    await preparePage(page);
    let submittedBody: Record<string, unknown> | undefined;
    await page.route('**/api/enquiry', async (handler) => { submittedBody = handler.request().postDataJSON() as Record<string, unknown>; await handler.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }); });
    await page.goto(programmePage.route);
    const expectedEnquiryType = programmePage.marker === 'commercial-pergolas-auckland'
      ? 'commercial'
      : 'residential';
    const main = page.locator(`main[data-seo-landing="${programmePage.marker}"]:visible`);
    const orderedFields = [
      '#acrylic-enquiry-type',
      '#acrylic-enquiry-suburb',
      '#acrylic-enquiry-message',
      '#acrylic-enquiry-name',
      '#acrylic-enquiry-phone',
      '#acrylic-enquiry-email',
      'input[name="widthM"]',
    ];

    await expect(main.locator('#acrylic-enquiry-type')).toHaveValue(expectedEnquiryType);
    await expect(main.locator('#acrylic-enquiry-type')).toHaveAttribute('required', '');
    await expect(main.locator('#acrylic-enquiry-name')).toHaveAttribute('required', '');
    await expect(main.locator('#acrylic-enquiry-phone')).toHaveAttribute('required', '');
    await expect(main.locator('#acrylic-enquiry-suburb')).not.toHaveAttribute('required', '');
    await expect(main.locator('#acrylic-enquiry-message')).not.toHaveAttribute('required', '');
    await expect(main.locator('#acrylic-enquiry-email')).not.toHaveAttribute('required', '');
    expect(await main.locator(orderedFields.join(', ')).evaluateAll((fields) => (
      fields.map((field) => field.id ? `#${field.id}` : `input[name="${field.getAttribute('name')}"]`)
    ))).toEqual(orderedFields);
    await expect(main.getByLabel('Roof approach Optional')).toBeVisible();
    await expect(main.getByText('Preferred roof approach', { exact: true })).toHaveCount(0);
    await expect(main.getByText('Possible roof approach', { exact: true })).toHaveCount(0);
    await expect(main.locator('#acrylic-enquiry-files')).toHaveAttribute(
      'accept',
      '.pdf,.jpg,.jpeg,.png,.webp',
    );
    await expect(main.getByText(
      'PDF, JPG, JPEG, PNG or WebP. Add up to 8 files. Each file can be up to 20 MB, with 20 MB total.',
      { exact: true },
    )).toBeVisible();
    await main.locator('#acrylic-enquiry-name').fill('Test Person');
    await main.locator('#acrylic-enquiry-phone').fill('021 000 0000');
    await main.locator('#acrylic-enquiry-email').fill('test@example.com');
    await main.locator('#acrylic-enquiry-suburb').fill('Auckland');
    await main.locator('#acrylic-enquiry-message').fill('We need a site-specific design and can send photos.');
    await main.locator(`#acrylic-enquiry-${programmePage.briefFieldName}`).fill('Page-specific project context.');
    await main.locator('#acrylic-enquiry-roof').selectOption('Combination roofing');
    await page.getByRole('button', { name: programmePage.submitLabel }).click();
    await expect(main.getByText('Thanks, we have received your project details.')).toBeVisible();
    await expect(main.locator('#acrylic-enquiry-name')).toHaveValue('Test Person');
    await expect(main.locator('#acrylic-enquiry-phone')).toHaveValue('021 000 0000');
    await expect(main.locator('#acrylic-enquiry-message')).toHaveValue('We need a site-specific design and can send photos.');
    expect(submittedBody).toMatchObject({
      enquiryType: expectedEnquiryType,
      enquiryContext: {
        enquiry_type: expectedEnquiryType,
        source_path: programmePage.route,
        source_component: 'embedded_form',
      },
      page: programmePage.route,
      source: 'website',
      roofMaterials: ['acrylic', 'timber'],
      projectDetails: {
        roofPreference: 'Combination roofing',
        [programmePage.briefFieldName]: 'Page-specific project context.',
      },
    });
  });

  test(`Page ${programmePage.order} ${programmePage.marker} sitemap links and schema are sound`, async ({ page, request }) => {
    await preparePage(page);
    await page.goto('/sitemap.xml');
    await expect(page.locator('body')).toContainText(programmePage.route);
    await page.goto(programmePage.route);
    const main = page.locator(`main[data-seo-landing="${programmePage.marker}"]:visible`);
    await expect(main).toHaveCount(1);
    const links = await main.locator('a[href^="/"]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute('href')).filter((href): href is string => Boolean(href) && !href.includes('#')))]);
    for (const href of links) expect((await request.get(href)).status(), `${href} should resolve`).toBeLessThan(400);
    const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((script) => { const parsed = JSON.parse(script) as unknown; return Array.isArray(parsed) ? parsed : [parsed]; }) as Array<{ '@type'?: string; dateModified?: string; reviewedBy?: { name?: string }; mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }> }>;
    const service = jsonLd.find((node) => node['@type'] === 'Service');
    if (programmePage.role === 'service') expect(service).toBeDefined();
    else expect(service).toBeUndefined();
    expect(jsonLd.find((node) => node['@type'] === 'FAQPage')).toBeUndefined();
    expect(jsonLd.find((node) => node['@type'] === 'BreadcrumbList')).toBeDefined();
    expect(jsonLd.find((node) => node['@type'] === 'WebPage')).toMatchObject({ dateModified: '2026-07-22', reviewedBy: { name: 'Sanctuary Pergolas' } });
  });
}

test('all programme pages keep unique SEO identities and the approved green accent', async ({ page }) => {
  expect(new Set(pages.map((item) => item.route)).size).toBe(pages.length);
  expect(new Set(pages.map((item) => item.title)).size).toBe(pages.length);
  expect(new Set(pages.map((item) => item.description)).size).toBe(pages.length);
  expect(new Set(pages.map((item) => item.h1)).size).toBe(pages.length);

  await preparePage(page);
  for (const programmePage of pages) {
    await page.goto(programmePage.route);
    const main = page.locator(`main[data-seo-landing="${programmePage.marker}"]:visible`);
    await expect(main).toHaveCount(1);
    const accent = await main.evaluate((main) => getComputedStyle(main).getPropertyValue('--color-accent-olive').trim());
    expect(accent, `${programmePage.route} should retain the olive-green foundation accent`).toBe('#4f5748');
  }
});

test('capture Phase 1 embedded commercial form at the target mobile widths', async ({
  page,
}) => {
  test.skip(!phaseOneCapture, 'Set MARKETING_PHASE_ONE_CAPTURE=1 to capture Phase 1 evidence.');
  await mkdir(phaseOneEvidenceDirectory, { recursive: true });
  await preparePage(page);

  for (const width of [360, 390, 430] as const) {
    await page.setViewportSize({ width, height: 932 });
    await page.goto('/commercial-pergolas-auckland#project-details', {
      waitUntil: 'networkidle',
    });
    const form = page.locator(
      'main[data-seo-landing="commercial-pergolas-auckland"] form.acrylic-form',
    );
    await expect(form).toBeVisible();
    await expect(form.getByLabel('Enquiry context')).toContainText('Commercial enquiry');
    await form.getByLabel('Enquiry context').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -72));
    await page.screenshot({
      path: path.join(
        phaseOneEvidenceDirectory,
        `embedded-commercial-form-${width}.png`,
      ),
    });
  }
});
