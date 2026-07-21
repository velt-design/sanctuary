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
    title: 'Aluminium Pergolas Auckland | Custom Sanctuary Design',
    description: 'Explore custom aluminium pergolas in Auckland. Understand frame proportion, roof integration, finish, structure and project scope before requesting a site-specific assessment.',
    h1: 'The frame sets the rhythm long before the roof is noticed',
    submitLabel: 'Send the project outline',
    faqCount: 9,
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
    projectCount: 4,
    captureId: 'cost-projects',
    comparisonId: 'cost-drivers-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 5,
    marker: 'gable-pergolas-auckland',
    route: '/gable-pergolas-auckland',
    title: 'Gable Pergolas Auckland | Custom Design & Installation',
    description: 'Explore custom gable pergolas in Auckland. Understand ridge height, pitch, gable ends, roofing, drainage and house integration before planning your project.',
    h1: 'A gable should borrow the home’s logic, not simply copy its pitch',
    submitLabel: 'Send the gable project',
    faqCount: 9,
    projectCount: 4,
    captureId: 'gable-projects',
    comparisonId: 'gable-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 6,
    marker: 'pitched-pergolas-auckland',
    route: '/pitched-pergolas-auckland',
    title: 'Pitched Pergolas Auckland | Custom Mono-Pitch Design',
    description: 'Explore custom pitched pergolas in Auckland. Plan the high edge, low edge, roof fall, daylight, drainage and house connection as one restrained roof form.',
    h1: 'One roof plane leaves nowhere for a weak line to hide',
    submitLabel: 'Send the pitched project',
    faqCount: 9,
    projectCount: 4,
    captureId: 'pitched-projects',
    comparisonId: 'pitched-decisions-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 7,
    marker: 'outdoor-rooms-auckland',
    route: '/outdoor-rooms-auckland',
    title: 'Outdoor Rooms Auckland | Custom Design & Installation',
    description: 'Plan a custom outdoor room in Auckland around dining, lounging, light, shelter and the home. Explore roof, edge, lighting and scope decisions with Sanctuary.',
    h1: 'Begin with the life inside the room, not the roof above it',
    submitLabel: 'Describe the room you need',
    faqCount: 10,
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
    faqCount: 10,
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
    faqCount: 10,
    projectCount: 4,
    captureId: 'acrylic-comparison-projects',
    comparisonId: 'roof-comparison-title',
    comparisonReferences: ['/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds', '/acrylic-roof-pergolas-auckland-v2'],
  },
  {
    order: 10,
    marker: 'commercial-pergolas-auckland',
    route: '/commercial-pergolas-auckland',
    title: 'Commercial Pergolas Auckland | Design & Installation',
    description: 'Plan a commercial pergola in Auckland around customers, staff, circulation, frontage, services, staging and clear project responsibility. Review Sanctuary project evidence.',
    h1: 'A commercial pergola has to work before, during and after service',
    submitLabel: 'Share the commercial brief',
    faqCount: 10,
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
      const main = page.locator(`main[data-seo-landing="${programmePage.marker}"]`);

      await expect(page).toHaveTitle(programmePage.title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${programmePage.route}`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', programmePage.description);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
      await expect(page.getByRole('heading', { level: 1, name: programmePage.h1 })).toBeVisible();
      await expect(main.locator('h1')).toHaveCount(1);
      await expect(main.locator('.acrylic-project-card img')).toHaveCount(programmePage.projectCount);
      await expect(main.locator('details')).toHaveCount(programmePage.faqCount);
      await expect(page.locator('#acrylic-enquiry-style')).toHaveValue('');
      await expect(page.locator('#acrylic-enquiry-roof')).toHaveValue('');
      const copy = await main.innerText();
      expect(copy).not.toContain('—');
      expect(copy).not.toContain('[[VERIFY:');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      if (viewport.width <= 900) {
        await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
        await expect(page.locator('header.site .desktop-nav')).toBeHidden();
      } else await expect(page.getByRole('link', { name: 'Quick Estimate' })).toBeVisible();

      if (capturePhase) {
        const directory = path.join(process.cwd(), 'artifacts', 'marketing-seo-landing', programmePage.marker);
        await mkdir(directory, { recursive: true });
        await page.screenshot({ path: path.join(directory, `${capturePhase}-${viewport.name}-top.png`) });
        await page.locator(`#${programmePage.captureId}`).scrollIntoViewIfNeeded();
        if (programmePage.projectCount) {
          await expect.poll(() => main.locator('.acrylic-project-card img').evaluateAll((images) => images.filter((image) => (image as HTMLImageElement).naturalWidth > 0).length)).toBe(programmePage.projectCount);
        }
        await page.screenshot({ path: path.join(directory, `${capturePhase}-${viewport.name}-proof.png`) });
        await page.locator(`#${programmePage.comparisonId}`).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, `${capturePhase}-${viewport.name}-decisions.png`) });
        await page.locator('#estimate-form-title').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, `${capturePhase}-${viewport.name}-form.png`) });
      }
    });
  }

  test(`Page ${programmePage.order} ${programmePage.marker} is original against earlier references`, async ({ page }) => {
    await preparePage(page);
    await page.goto(programmePage.route);
    const currentMain = page.locator(`main[data-seo-landing="${programmePage.marker}"]`);
    const currentCopy = await currentMain.innerText();
    const currentHeadings = await currentMain.locator('h1, h2').allTextContents();
    for (const reference of programmePage.comparisonReferences) {
      await page.goto(reference);
      const referenceMain = page.locator('main.acrylic-landing');
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
    await page.locator('#acrylic-enquiry-type').selectOption('residential');
    await page.locator('#acrylic-enquiry-name').fill('Test Person');
    await page.locator('#acrylic-enquiry-phone').fill('021 000 0000');
    await page.locator('#acrylic-enquiry-email').fill('test@example.com');
    await page.locator('#acrylic-enquiry-suburb').fill('Auckland');
    await page.locator('#acrylic-enquiry-message').fill('We need a site-specific design and can send photos.');
    await page.locator('#acrylic-enquiry-roof').selectOption('Combination roofing');
    await page.getByRole('button', { name: programmePage.submitLabel }).click();
    await expect(page.getByText('Thanks, we have received your project details.')).toBeVisible();
    expect(submittedBody).toMatchObject({ page: programmePage.route, source: 'website', roofMaterials: ['acrylic', 'timber'], projectDetails: { roofPreference: 'Combination roofing' } });
  });

  test(`Page ${programmePage.order} ${programmePage.marker} sitemap links and schema are sound`, async ({ page, request }) => {
    await preparePage(page);
    await page.goto('/sitemap.xml');
    await expect(page.locator('body')).toContainText(programmePage.route);
    await page.goto(programmePage.route);
    const main = page.locator(`main[data-seo-landing="${programmePage.marker}"]`);
    const links = await main.locator('a[href^="/"]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute('href')).filter((href): href is string => Boolean(href) && !href.includes('#')))]);
    for (const href of links) expect((await request.get(href)).status(), `${href} should resolve`).toBeLessThan(400);
    const questions = await main.locator('details summary h3').allTextContents();
    const answers = await main.locator('details > div').evaluateAll((nodes) => nodes.map((node) => [...node.querySelectorAll('p')].map((paragraph) => paragraph.textContent?.trim() ?? '').join('\n\n')));
    const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((script) => { const parsed = JSON.parse(script) as unknown; return Array.isArray(parsed) ? parsed : [parsed]; }) as Array<{ '@type'?: string; mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }> }>;
    const faq = jsonLd.find((node) => node['@type'] === 'FAQPage');
    expect(jsonLd.find((node) => node['@type'] === 'Service')).toBeDefined();
    expect(faq?.mainEntity?.map((item) => item.name)).toEqual(questions);
    expect(faq?.mainEntity?.map((item) => item.acceptedAnswer.text.replace(/\s+/g, ' ').trim())).toEqual(answers.map((answer) => answer.replace(/\s+/g, ' ').trim()));
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
    const accent = await page.locator(`main[data-seo-landing="${programmePage.marker}"]`).evaluate((main) => getComputedStyle(main).getPropertyValue('--color-accent-olive').trim());
    expect(accent, `${programmePage.route} should retain the olive-green foundation accent`).toBe('#4f5748');
  }
});
