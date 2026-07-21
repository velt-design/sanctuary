import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const route = '/acrylic-roof-pergolas-auckland-v2';
const canonicalRoute = '/acrylic-roof-pergolas-auckland';
const metaDescription = 'Planning an acrylic roof pergola in Auckland? Compare daylight, tint, roof form and weather trade-offs, then send photos for a site-specific first assessment.';
const capturePhase = process.env.MARKETING_COPY_CAPTURE_PHASE?.trim();
const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-acrylic-copy-variant');
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
  test(`copy variant is publish-ready at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await page.goto(route);
    const variantMain = page.locator('main[data-copy-variant="context-pack-v2"]');

    await expect(page).toHaveTitle('Acrylic Roof Pergolas Auckland | Custom Design by Sanctuary');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${canonicalRoute}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', metaDescription);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Cover the Deck Without Giving Up the Light');
    await expect(variantMain).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Cover the deck without giving up the daylight inside' })).toBeVisible();
    await expect(variantMain.locator('h1')).toHaveCount(1);
    await expect(page.locator('header.site')).toBeVisible();
    await expect(page.locator('footer')).toBeAttached();
    await expect(page.getByLabel('Phone', { exact: false })).toHaveAttribute('required', '');
    await expect(page.locator('#acrylic-enquiry-style')).toHaveValue('');
    await expect(page.locator('#acrylic-enquiry-roof')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Send my project details' })).toBeVisible();
    await expect(variantMain).toContainText('Custom acrylic roof pergolas in Auckland');
    await expect(variantMain).not.toContainText('Acrylic roof pergolas for Auckland homes, designed to keep the light');
    await expect(variantMain).not.toContainText('Cover the space without closing it in');

    const publicCopy = await variantMain.innerText();
    expect(publicCopy).not.toContain('—');
    expect(publicCopy).not.toContain('[[VERIFY:');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const projectImages = page.locator('.acrylic-project-card img');
    await expect(projectImages).toHaveCount(4);
    const details = variantMain.locator('details');
    await expect(details).toHaveCount(12);

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
      await page.locator('#project-evidence').scrollIntoViewIfNeeded();
      await projectImages.first().scrollIntoViewIfNeeded();
      await expect.poll(() => projectImages.first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-proof.png`) });
      await page.locator('#tint-tradeoff').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-options.png`) });
      await page.locator('#weather-boundary').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-weather.png`) });
      await page.locator('#estimate-form-title').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDirectory, `${capturePhase}-${viewport.name}-form.png`) });
    }
  });
}

test('copy variant is materially original rather than a light rewrite', async ({ page }) => {
  await preparePage(page);
  await page.goto(route);
  const variantCopy = await page.locator('main[data-copy-variant="context-pack-v2"]').innerText();
  const variantHeadings = await page.locator('main[data-copy-variant="context-pack-v2"] h1, main[data-copy-variant="context-pack-v2"] h2').allTextContents();

  await page.goto(canonicalRoute);
  const canonicalCopy = await page.locator('main.acrylic-landing').innerText();
  const canonicalHeadings = await page.locator('main.acrylic-landing h1, main.acrylic-landing h2').allTextContents();

  const repeatedHeadings = variantHeadings.filter((heading) => canonicalHeadings.includes(heading));
  expect(repeatedHeadings).toEqual([]);
  expect(jaccardSimilarity(wordShingles(variantCopy), wordShingles(canonicalCopy))).toBeLessThan(0.12);
});

test('copy variant enquiry keeps validation, API attribution and route-specific tracking', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  let submittedBody: Record<string, unknown> | undefined;
  await page.route('**/api/enquiry', async (routeHandler) => {
    submittedBody = routeHandler.request().postDataJSON() as Record<string, unknown>;
    await routeHandler.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto(route);

  const message = page.locator('#acrylic-enquiry-message');
  await message.fill('We want to use the deck for dinner without making the kitchen feel darker.');
  await page.getByRole('button', { name: 'Send my project details' }).click();
  await expect(page.getByText('Choose an enquiry type.')).toBeVisible();
  await expect(message).toHaveValue('We want to use the deck for dinner without making the kitchen feel darker.');

  await page.locator('#acrylic-enquiry-type').selectOption('residential');
  await page.locator('#acrylic-enquiry-name').fill('Test Person');
  await page.locator('#acrylic-enquiry-phone').fill('021 000 0000');
  await page.locator('#acrylic-enquiry-email').fill('test@example.com');
  await page.locator('#acrylic-enquiry-suburb').fill('Auckland');
  await page.getByRole('button', { name: 'Send my project details' }).click();

  await expect(page.getByText('Thanks, we have received your project details.')).toBeVisible();
  expect(submittedBody).toMatchObject({ page: route, source: 'website' });
  expect(await page.evaluate(() => {
    type TrackingWindow = Window & { dataLayer?: Array<Record<string, unknown>> };
    return (window as TrackingWindow).dataLayer?.find((event) => event.event === 'lead_submitted')?.landing_page;
  })).toBe(route);

  const faq = page.locator('details').filter({ hasText: 'Which acrylic tint is best for an Auckland pergola?' });
  await expect(faq).toHaveCount(1);
  await faq.locator('summary').click();
  await expect(faq).toHaveAttribute('open', '');
});

test('copy variant remains outside the public sitemap while under review', async ({ page }) => {
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText(route);
  await expect(page.locator('body')).toContainText(canonicalRoute);
});

test('copy variant internal links resolve and FAQ schema matches visible copy', async ({ page, request }) => {
  await preparePage(page);
  await page.goto(route);
  const variantMain = page.locator('main[data-copy-variant="context-pack-v2"]');
  const internalLinks = await variantMain.locator('a[href^="/"]').evaluateAll((links) => (
    [...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href) && !href.startsWith('/#')))]
  ));

  for (const href of internalLinks) {
    const response = await request.get(href);
    expect(response.status(), `${href} should resolve`).toBeLessThan(400);
  }

  const visibleQuestions = await variantMain.locator('details summary h3').allTextContents();
  const visibleAnswers = await variantMain.locator('details > div').evaluateAll((answers) => answers.map((answer) => (
    [...answer.querySelectorAll('p')].map((paragraph) => paragraph.textContent?.trim() ?? '').join('\n\n')
  )));
  const jsonLdScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const jsonLdNodes = jsonLdScripts.flatMap((script) => {
    const parsed = JSON.parse(script) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  }) as Array<{ '@type'?: string; mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }> }>;
  const faqSchema = jsonLdNodes.find((node) => node['@type'] === 'FAQPage');

  expect(faqSchema?.mainEntity?.map((item) => item.name)).toEqual(visibleQuestions);
  expect(faqSchema?.mainEntity?.map((item) => item.acceptedAnswer.text.replace(/\s+/g, ' ').trim())).toEqual(
    visibleAnswers.map((answer) => answer.replace(/\s+/g, ' ').trim()),
  );
});
