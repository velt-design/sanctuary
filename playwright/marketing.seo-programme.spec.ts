import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

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
  showGuideNavigation?: false;
};

const pages: ProgrammePage[] = [
  {
    order: 3,
    marker: 'aluminium-pergolas-auckland',
    route: '/aluminium-pergolas-auckland',
    title: 'Aluminium Pergolas Auckland | Frame & Finish Guide',
    description: 'Plan an aluminium pergola around frame proportion, roofing, drainage, finish and the Auckland site.',
    h1: 'Aluminium pergolas for Auckland homes.',
    submitLabel: 'Send project brief',
    faqCount: 4,
    role: 'product-guide',
    briefFieldName: 'openingPriorities',
    projectCount: 2,
    captureId: 'aluminium-projects',
    comparisonId: 'aluminium-specification-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland'],
  },
  {
    order: 4,
    marker: 'pergola-cost-auckland',
    route: '/pergola-cost-auckland',
    title: 'Pergola Cost Auckland | Scope & Quote Guide',
    description: 'Understand the design, structure, roofing, site work and options that shape an Auckland pergola quote.',
    h1: 'Pergola cost starts with scope.',
    submitLabel: 'Send project brief',
    faqCount: 4,
    role: 'decision-guide',
    briefFieldName: 'scopePriorities',
    projectCount: 3,
    captureId: 'cost-projects',
    comparisonId: 'cost-drivers-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland'],
  },
  {
    order: 5,
    marker: 'gable-pergolas-auckland',
    route: '/gable-pergolas-auckland',
    title: 'Gable Pergolas Auckland | Roof Form Guide',
    description: 'Plan a gable pergola around ridge height, pitch, eaves, roofing, drainage and the Auckland home.',
    h1: 'Gable pergolas for Auckland homes.',
    submitLabel: 'Send project brief',
    faqCount: 4,
    role: 'product-guide',
    briefFieldName: 'gableRelationship',
    projectCount: 3,
    captureId: 'gable-projects',
    comparisonId: 'gable-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland'],
  },
  {
    order: 6,
    marker: 'pitched-pergolas-auckland',
    route: '/pitched-pergolas-auckland',
    title: 'Pitched Pergolas Auckland | Mono-Pitch Roof Guide',
    description: 'Plan a pitched pergola around the house connection, available height, roof fall and drainage.',
    h1: 'Pitched pergolas for Auckland homes.',
    submitLabel: 'Send project brief',
    faqCount: 4,
    role: 'product-guide',
    briefFieldName: 'highEdgeContext',
    projectCount: 3,
    captureId: 'pitched-projects',
    comparisonId: 'pitched-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland'],
  },
  {
    order: 7,
    marker: 'outdoor-rooms-auckland',
    route: '/outdoor-rooms-auckland',
    title: 'Outdoor Rooms Auckland | Design & Installation',
    description: 'Plan an Auckland outdoor room around use, furniture, roofing, edges, lighting and services.',
    h1: 'Outdoor rooms designed around how you use them.',
    submitLabel: 'Send project brief',
    faqCount: 4,
    role: 'service',
    briefFieldName: 'roomActivities',
    projectCount: 3,
    captureId: 'outdoor-room-projects',
    comparisonId: 'outdoor-room-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland'],
  },
  {
    order: 8,
    marker: 'pergolas-with-blinds',
    route: '/pergolas-with-blinds',
    title: 'Pergolas With Blinds Auckland | Integrated Outdoor Screens',
    description: 'Plan pergola blinds around one exposed edge, the measured opening and the selected system.',
    h1: 'Plan blinds as part of the pergola.',
    submitLabel: 'Send project brief',
    faqCount: 4,
    role: 'product-guide',
    briefFieldName: 'openingDimensions',
    projectCount: 2,
    captureId: 'blind-projects',
    comparisonId: 'blind-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland'],
  },
  {
    order: 9,
    marker: 'acrylic-pergolas-vs-louvre-roofs',
    route: '/acrylic-pergolas-vs-louvre-roofs',
    title: 'Acrylic Pergolas vs Louvre Roofs | Auckland Guide',
    description: 'Compare Sanctuary fixed acrylic roofs with an external louvre proposal using one project brief and complete scope.',
    h1: 'Acrylic roof or louvre roof?',
    submitLabel: 'Send project brief',
    faqCount: 4,
    role: 'decision-guide',
    briefFieldName: 'comparisonPriorities',
    projectCount: 2,
    captureId: 'acrylic-comparison-projects',
    comparisonId: 'roof-comparison-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds'],
  },
  {
    order: 10,
    marker: 'commercial-pergolas-auckland',
    route: '/commercial-pergolas-auckland',
    title: 'Commercial Pergolas Auckland | Design & Build',
    description: 'Sanctuary designs and builds commercial pergolas in Auckland, coordinating engineering, consent and trades where required from venue brief to installation.',
    h1: 'Commercial pergolas, designed and installed.',
    submitLabel: 'Send project brief',
    faqCount: 4,
    role: 'service',
    briefFieldName: 'operatingConstraints',
    projectCount: 3,
    captureId: 'commercial-projects',
    comparisonId: 'commercial-capability-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds', '/acrylic-pergolas-vs-louvre-roofs'],
    showGuideNavigation: false,
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

async function getEditorialCopy(main: Locator) {
  return main.evaluate((element) => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('#project-details, form, script').forEach((node) => {
      node.remove();
    });
    return copy.textContent ?? '';
  });
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
      const guideNavigation = main.getByRole('navigation', {
        name: 'Pergola guide progression',
      });
      if (programmePage.showGuideNavigation === false) {
        await expect(guideNavigation).toHaveCount(0);
        await expect(
          main.getByText('Editorial review: Sanctuary Pergolas'),
        ).toHaveCount(0);
        await expect(main.locator('time[datetime="2026-07-22"]')).toHaveCount(
          0,
        );
      } else {
        await expect(guideNavigation).toBeVisible();
        await expect(
          main.getByText('Editorial review: Sanctuary Pergolas'),
        ).toBeVisible();
        await expect(main.locator('time[datetime="2026-07-22"]')).toHaveText(
          '22 July 2026',
        );
      }
      await expect(main.locator('.seo-landing__project-facts')).toHaveCount(programmePage.projectCount);
      const optionalProjectDetails = main.locator('details.acrylic-form__optional');
      await expect(optionalProjectDetails).toBeAttached();
      if ((await optionalProjectDetails.getAttribute('open')) === null) {
        await optionalProjectDetails.locator(':scope > summary').click();
      }
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
        await expect(main.getByRole('heading', { level: 2, name: 'Three projects. Three delivery roles.' })).toBeVisible();
        await expect(main.getByRole('heading', { level: 2, name: 'From brief to installation.' })).toBeVisible();
        await expect(main.getByRole('heading', { level: 3, name: 'Coordinate the project' })).toBeVisible();
        await expect(main.getByRole('heading', { level: 3, name: 'Install and hand over' })).toBeVisible();
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
        await expect(consentFaq.getByText(/Requirements and decisions remain project-specific/)).toBeVisible();
        await expect(main.getByRole('heading', { level: 2, name: 'Tell us about the project.' })).toBeVisible();
        await expect(main.getByRole('link', { name: 'Call 022 854 5633' })).toHaveAttribute('href', 'tel:+64228545633');
        await expect(main.getByRole('link', { name: 'Email Sanctuary' })).toHaveAttribute('href', 'mailto:info@sanctuarypergolas.co.nz');
        await expect(main.locator('#commercial-projects .acrylic-project-card h3')).toHaveText([
          'The Good Home Takanini',
          'Lilliput Mini Golf',
          'KiwiRail Head Office',
        ]);
      }

      if (viewport.width <= 900) {
        await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
        await expect(page.locator('header.site .desktop-nav')).toBeHidden();
      } else {
        await expect(
          page.locator('header.site').getByRole('link', { name: 'Start your project' }),
        ).toBeVisible();
      }

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
    const currentCopy = await getEditorialCopy(currentMain);
    const currentH1 = await currentMain.locator('h1').innerText();
    for (const reference of programmePage.comparisonReferences) {
      await page.goto(reference);
      const referenceMain = page.locator('main.acrylic-landing:visible');
      const referenceCopy = await getEditorialCopy(referenceMain);
      const referenceH1 = await referenceMain.locator('h1').innerText();
      expect(currentH1, `${programmePage.route} repeats an H1 from ${reference}`).not.toBe(referenceH1);
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
    await expect(main.locator('#acrylic-enquiry-email')).toHaveAttribute('required', '');
    await expect(main.locator('#acrylic-enquiry-suburb')).not.toHaveAttribute('required', '');
    await expect(main.locator('#acrylic-enquiry-message')).not.toHaveAttribute('required', '');
    await expect(main.locator('form.acrylic-form')).toHaveAttribute('method', 'post');
    await expect(main.locator('form.acrylic-form')).toHaveAttribute(
      'action',
      '/api/enquiry/fallback',
    );
    expect(await main.locator(orderedFields.join(', ')).evaluateAll((fields) => (
      fields.map((field) => field.id ? `#${field.id}` : `input[name="${field.getAttribute('name')}"]`)
    ))).toEqual(orderedFields);
    const optionalProjectDetails = main.locator('details.acrylic-form__optional');
    await expect(optionalProjectDetails).toBeAttached();
    if ((await optionalProjectDetails.getAttribute('open')) === null) {
      await optionalProjectDetails.locator(':scope > summary').click();
    }
    await expect(main.getByLabel('Roof Optional')).toBeVisible();
    await expect(main.getByText('Preferred roof approach', { exact: true })).toHaveCount(0);
    await expect(main.getByText('Possible roof approach', { exact: true })).toHaveCount(0);
    await expect(main.locator('#acrylic-enquiry-files')).toHaveAttribute(
      'accept',
      '.pdf,.jpg,.jpeg,.png,.webp',
    );
    await expect(main.getByText(
      'Up to 8 PDF, JPG, JPEG, PNG or WebP files, 20 MB total.',
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
    await expect(main.getByRole('heading', { name: 'Project brief sent.' })).toBeVisible();
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
