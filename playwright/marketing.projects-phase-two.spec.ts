import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { projects } from '../apps/marketing/data/projects';

const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
const representativeRoute = `/projects/${projects[0].slug}`;
const phaseTwoCapture = process.env.MARKETING_PHASE_TWO_CAPTURE === '1';
const phaseTwoEvidenceDirectory = resolve('artifacts/mobile-ux-phase-2');
const productionCollectionBaseline = [
  {
    width: 430,
    htmlBytes: 174_571,
    documentNodes: 510,
    caseStudyCount: 1,
    caseStudyTextCharacters: 4_047,
    caseStudyImages: 10,
    caseStudyGalleryFigures: 6,
    transferredImageBytes: 239_179,
    hiddenHeroLoaded: true,
  },
  {
    width: 390,
    htmlBytes: 174_571,
    documentNodes: 510,
    caseStudyCount: 1,
    caseStudyTextCharacters: 4_047,
    caseStudyImages: 10,
    caseStudyGalleryFigures: 6,
    transferredImageBytes: 139_605,
    hiddenHeroLoaded: true,
  },
  {
    width: 360,
    htmlBytes: 174_571,
    documentNodes: 510,
    caseStudyCount: 1,
    caseStudyTextCharacters: 4_047,
    caseStudyImages: 10,
    caseStudyGalleryFigures: 6,
    transferredImageBytes: 139_605,
    hiddenHeroLoaded: true,
  },
] as const;

async function dismissConsent(page: Page) {
  const essentialOnly = page.getByRole('button', { name: 'Essential only' });
  if (await essentialOnly.count() && await essentialOnly.isVisible()) {
    await essentialOnly.click();
  }
}

function visibleProjectsMain(page: Page) {
  return page.locator('main[data-projects-experience]:visible').last();
}

test('capture Phase 2 project collection payload evidence', async ({
  browser,
}, testInfo) => {
  test.skip(
    !phaseTwoCapture,
    'Set MARKETING_PHASE_TWO_CAPTURE=1 to capture Phase 2 evidence.',
  );
  await mkdir(phaseTwoEvidenceDirectory, { recursive: true });
  const baseURL = String(testInfo.project.use.baseURL);
  const captureSource = new URL(baseURL).origin === publicOrigin
    ? 'production after Phase 2'
    : 'local Phase 2 checkpoint 1';
  const after: Array<Record<string, number | boolean>> = [];

  for (const width of [430, 390, 360]) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height: 932 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const response = await page.goto('/projects', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBe(true);
    await dismissConsent(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const body = await response!.body();
    const metrics = await page.evaluate(() => {
      const detail = document.querySelector('.project-case-study');
      const resources = performance.getEntriesByType('resource');

      return {
        documentNodes: document.querySelectorAll('*').length,
        caseStudyCount: document.querySelectorAll('.project-case-study').length,
        caseStudyTextCharacters: detail?.textContent?.length ?? 0,
        caseStudyImages: document.querySelectorAll('.project-case-study img').length,
        caseStudyGalleryFigures: document.querySelectorAll(
          '.project-case-study__gallery figure',
        ).length,
        hiddenHeroLoaded: [...document.querySelectorAll<HTMLImageElement>(
          '.project-case-study img',
        )].some((image) => image.currentSrc.length > 0),
        projectCards: document.querySelectorAll('[data-project-card]').length,
        transferredImageBytes: resources
          .filter((entry) => entry.initiatorType === 'img')
          .reduce((sum, entry) => sum + entry.transferSize, 0),
      };
    });

    after.push({ width, htmlBytes: body.byteLength, ...metrics });
    await page.screenshot({
      path: resolve(
        phaseTwoEvidenceDirectory,
        `after-project-index-${width}.png`,
      ),
      fullPage: false,
    });
    await context.close();
  }

  await writeFile(
    resolve(phaseTwoEvidenceDirectory, 'project-collection-payload.json'),
    `${JSON.stringify({
      baseline: {
        capturedFrom: 'production before Phase 2',
        route: '/projects',
        values: productionCollectionBaseline,
      },
      after: {
        capturedFrom: captureSource,
        route: '/projects',
        values: after,
      },
    }, null, 2)}\n`,
    'utf8',
  );
});

test('capture Phase 2 controlled project gallery evidence', async ({
  browser,
}, testInfo) => {
  test.skip(
    !phaseTwoCapture,
    'Set MARKETING_PHASE_TWO_CAPTURE=1 to capture Phase 2 evidence.',
  );
  await mkdir(phaseTwoEvidenceDirectory, { recursive: true });
  const baseURL = String(testInfo.project.use.baseURL);

  for (const width of [430, 390, 360]) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height: 932 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(representativeRoute);
    await dismissConsent(page);
    const gallery = visibleProjectsMain(page).locator('[data-responsive-gallery]');
    await gallery.scrollIntoViewIfNeeded();
    await expect(gallery).toBeVisible();
    await gallery.screenshot({
      path: resolve(
        phaseTwoEvidenceDirectory,
        `after-project-gallery-${width}.png`,
      ),
    });
    await context.close();
  }

  const desktopContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(representativeRoute);
  await dismissConsent(desktopPage);
  const desktopGallery = visibleProjectsMain(desktopPage).locator(
    '[data-project-gallery-layout="desktop"]',
  );
  for (const image of await desktopGallery.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(
      () => image.evaluate(
        (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
      ),
    ).toBe(true);
  }
  await dismissConsent(desktopPage);
  await desktopGallery.locator('figure').first().scrollIntoViewIfNeeded();
  await expect(desktopGallery).toBeVisible();
  await desktopPage.screenshot({
    path: resolve(
      phaseTwoEvidenceDirectory,
      'after-project-gallery-desktop.png',
    ),
    fullPage: false,
  });
  await desktopContext.close();
});
