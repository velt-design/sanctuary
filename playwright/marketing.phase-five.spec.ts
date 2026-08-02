import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Browser } from '@playwright/test';

const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
const releaseHeader = 'x-sanctuary-release';
const releaseShaPattern = /^[a-f0-9]{7,40}$/;
const capture = process.env.MARKETING_PHASE_FIVE_CAPTURE === '1';
const evidenceDirectory = resolve(
  process.env.MARKETING_PHASE_FIVE_EVIDENCE_DIR?.trim()
    || 'artifacts/mobile-ux-phase-5/automated',
);
const targetViewports = [
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;
const evidenceRoutes = [
  { id: 'home', path: '/' },
  { id: 'projects', path: '/projects' },
  {
    id: 'project-detail',
    path: '/projects/warkworth-outdoor-room',
  },
  { id: 'residential-service', path: '/pergolas-auckland' },
  { id: 'custom-service', path: '/custom-pergolas-auckland' },
  { id: 'products', path: '/products' },
  { id: 'product-detail', path: '/products/pergolas/gable' },
  { id: 'commercial', path: '/commercial-pergolas-auckland' },
  { id: 'professional', path: '/architects-designers-builders' },
  { id: 'guides', path: '/pergola-guides' },
  { id: 'guide-detail', path: '/pergola-cost-auckland' },
  { id: 'contact', path: '/contact' },
] as const;
const screenshotRoutes = new Set([
  'home',
  'project-detail',
  'residential-service',
  'custom-service',
  'product-detail',
  'commercial',
  'professional',
  'guide-detail',
  'contact',
]);

const semanticParityRoutes = [
  {
    path: '/',
    requiredMarkers: [
      'data-homepage-variant="project_finder_home_v2"',
      'Outdoor spaces designed around the way you live.',
      'role="radiogroup"',
      'application/ld+json',
      'id="footer-contact-heading"',
    ],
    exactMarkerCounts: [
      ['data-project-direction=', 3],
      ['data-audience-path=', 2],
    ],
  },
  {
    path: '/projects',
    requiredMarkers: ['data-projects-experience'],
    hasFooter: false,
  },
  {
    path: '/projects/warkworth-outdoor-room',
    requiredMarkers: [
      'data-project-gallery-shell',
      'data-project-gallery-layout="responsive-strip"',
      'aria-label="Previous image in Warkworth Outdoor Room project gallery"',
      'aria-live="polite"',
    ],
  },
  {
    path: '/pergolas-auckland',
    requiredMarkers: [
      'data-seo-landing="pergolas-auckland"',
      'data-service-major-section="support"',
    ],
    exactMarkerCounts: [
      ['data-service-major-section=', 6],
      ['class="acrylic-project-card"', 3],
    ],
  },
  {
    path: '/custom-pergolas-auckland',
    requiredMarkers: [
      'data-seo-landing="custom-pergolas-auckland"',
      'data-seo-landing-disclosure="custom-planning-support"',
    ],
    forbiddenMarkers: [
      'Pergola guide progression',
      'Service guide',
      'Previous guide',
      'Next guide',
    ],
    exactMarkerCounts: [
      ['class="acrylic-project-card"', 3],
      ['data-seo-landing-disclosure=', 1],
    ],
  },
  {
    path: '/products',
    requiredMarkers: ['data-products-index'],
  },
  {
    path: '/products/pergolas/gable',
    requiredMarkers: ['data-product-detail'],
  },
  {
    path: '/commercial-pergolas-auckland',
    requiredMarkers: [
      'data-seo-landing="commercial-pergolas-auckland"',
      'id="commercial-projects"',
      'id="commercial-process"',
    ],
    forbiddenMarkers: [
      'Pergola guide progression',
      'Service guide',
      'Previous guide',
      'Next guide',
    ],
    exactMarkerCounts: [
      ['class="acrylic-project-card"', 3],
      ['data-seo-landing-disclosure=', 1],
    ],
  },
  {
    path: '/architects-designers-builders',
    requiredMarkers: [
      'data-seo-landing="architects-designers-builders"',
      'Professional project',
    ],
    forbiddenMarkers: [
      'Pergola guide progression',
      'Service guide',
      'Previous guide',
      'Next guide',
    ],
    exactMarkerCounts: [
      ['class="acrylic-project-card"', 3],
      ['data-seo-landing-disclosure=', 2],
    ],
  },
  {
    path: '/pergola-guides',
    requiredMarkers: ['data-pergola-guide-hub'],
  },
  {
    path: '/pergola-cost-auckland',
    requiredMarkers: [
      'data-guide-first-layer-project',
      'data-guide-first-layer-return',
      'data-guide-supporting-depth',
    ],
  },
  {
    path: '/contact',
    requiredMarkers: ['data-contact-page'],
  },
] as const;

async function createMeasuredPage(
  browser: Browser,
  baseURL: string,
  viewport: (typeof targetViewports)[number],
) {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem(
      'sp_consent_v1',
      JSON.stringify({
        analytics: false,
        marketing: false,
        updatedAt: '2026-07-26T00:00:00.000Z',
        version: 1,
      }),
    );
    const measuredWindow = window as typeof window & {
      __phaseFiveCls?: number;
      __phaseFiveLcpMs?: number;
      __phaseFiveLongTaskCount?: number;
      __phaseFiveLongTaskMs?: number;
      __phaseFiveMaxLongTaskMs?: number;
    };
    measuredWindow.__phaseFiveCls = 0;
    measuredWindow.__phaseFiveLcpMs = 0;
    measuredWindow.__phaseFiveLongTaskCount = 0;
    measuredWindow.__phaseFiveLongTaskMs = 0;
    measuredWindow.__phaseFiveMaxLongTaskMs = 0;
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (!shift.hadRecentInput) {
          measuredWindow.__phaseFiveCls =
            (measuredWindow.__phaseFiveCls ?? 0) + (shift.value ?? 0);
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
    try {
      new PerformanceObserver((entries) => {
        const lastEntry = entries.getEntries().at(-1);
        if (lastEntry) {
          measuredWindow.__phaseFiveLcpMs = lastEntry.startTime;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP observation is supporting lab evidence only.
    }
    try {
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          measuredWindow.__phaseFiveLongTaskCount =
            (measuredWindow.__phaseFiveLongTaskCount ?? 0) + 1;
          measuredWindow.__phaseFiveLongTaskMs =
            (measuredWindow.__phaseFiveLongTaskMs ?? 0) + entry.duration;
          measuredWindow.__phaseFiveMaxLongTaskMs = Math.max(
            measuredWindow.__phaseFiveMaxLongTaskMs ?? 0,
            entry.duration,
          );
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // Long-task observation is supporting lab evidence only.
    }
  });
  return { context, page: await context.newPage() };
}

async function warmPage(page: Awaited<ReturnType<typeof createMeasuredPage>>['page']) {
  await page.evaluate(async () => {
    const step = Math.max(320, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolveStep) => setTimeout(resolveStep, 12));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
}

async function measureInitialLoad(
  page: Awaited<ReturnType<typeof createMeasuredPage>>['page'],
) {
  return page.evaluate(() => {
    const measuredWindow = window as typeof window & {
      __phaseFiveLcpMs?: number;
    };
    const navigation = performance.getEntriesByType(
      'navigation',
    )[0] as PerformanceNavigationTiming | undefined;
    const firstContentfulPaint = performance
      .getEntriesByName('first-contentful-paint')[0];

    return {
      firstContentfulPaintMs: Math.round(firstContentfulPaint?.startTime ?? 0),
      largestContentfulPaintMs: Math.round(
        measuredWindow.__phaseFiveLcpMs ?? 0,
      ),
      timeToFirstByteMs: Math.round(navigation?.responseStart ?? 0),
    };
  });
}

async function measurePage(
  page: Awaited<ReturnType<typeof createMeasuredPage>>['page'],
) {
  return page.evaluate(() => {
    const measuredWindow = window as typeof window & {
      __phaseFiveCls?: number;
      __phaseFiveLongTaskCount?: number;
      __phaseFiveLongTaskMs?: number;
      __phaseFiveMaxLongTaskMs?: number;
    };
    const resources = performance.getEntriesByType(
      'resource',
    ) as PerformanceResourceTiming[];
    const interactive = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, summary, input:not([type="hidden"]), select, textarea',
      ),
    ].filter(
      (element) =>
        element.checkVisibility()
        && !element.closest('[inert], [aria-hidden="true"]'),
    );
    const targetSize = (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect();
      return {
        className: element.className,
        height: Math.round(bounds.height),
        label:
          element.getAttribute('aria-label')
          ?? element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80)
          ?? element.tagName.toLowerCase(),
        name:
          element instanceof HTMLInputElement
            || element instanceof HTMLSelectElement
            || element instanceof HTMLTextAreaElement
            ? element.name
            : null,
        tag: element.tagName.toLowerCase(),
        type:
          element instanceof HTMLInputElement
            || element instanceof HTMLButtonElement
            ? element.type
            : null,
        width: Math.round(bounds.width),
      };
    };
    const isUndersized = (element: HTMLElement) => {
      const { height, width } = targetSize(element);
      return width < 44 || height < 44;
    };
    const isPrimaryTouchTarget = (element: HTMLElement) => {
      if (
        element instanceof HTMLInputElement
        && ['checkbox', 'radio'].includes(element.type)
      ) {
        const label = element.closest<HTMLElement>('label');
        return !label || isUndersized(label);
      }
      if (element instanceof HTMLAnchorElement) {
        return getComputedStyle(element).display !== 'inline';
      }
      return true;
    };
    const undersizedTargetCount = interactive.filter(isUndersized).length;
    const undersizedPrimaryTargets = interactive
      .filter(isUndersized)
      .filter(isPrimaryTouchTarget)
      .map(targetSize);
    const ids = [...document.querySelectorAll<HTMLElement>('[id]')]
      .map(({ id }) => id)
      .filter(Boolean);
    const duplicateIds = [...new Set(ids.filter(
      (id, index) => ids.indexOf(id) !== index,
    ))];
    const brokenImages = [...document.images]
      .filter((image) => {
        if (!image.checkVisibility()) return false;
        const bounds = image.getBoundingClientRect();
        return (
          bounds.bottom > 0
          && bounds.right > 0
          && bounds.top < window.innerHeight
          && bounds.left < window.innerWidth
        );
      })
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.alt || image.currentSrc || image.src);
    const resourceBytes = (type?: string) => resources
      .filter((entry) => !type || entry.initiatorType === type)
      .reduce(
        (total, entry) =>
          total + (entry.transferSize || entry.encodedBodySize || 0),
        0,
      );

    return {
      brokenImages,
      cls: Number((measuredWindow.__phaseFiveCls ?? 0).toFixed(4)),
      documentHeight: document.documentElement.scrollHeight,
      duplicateIds,
      h1Count: document.querySelectorAll('h1').length,
      imageRequests: resources.filter(
        ({ initiatorType }) => initiatorType === 'img',
      ).length,
      imageTransferBytes: resourceBytes('img'),
      interactiveCount: interactive.length,
      longTaskCount: measuredWindow.__phaseFiveLongTaskCount ?? 0,
      longTaskMs: Math.round(measuredWindow.__phaseFiveLongTaskMs ?? 0),
      mainCount: document.querySelectorAll('main').length,
      maxLongTaskMs: Math.round(
        measuredWindow.__phaseFiveMaxLongTaskMs ?? 0,
      ),
      overflow:
        document.documentElement.scrollWidth
        > document.documentElement.clientWidth + 1,
      scriptTransferBytes: resourceBytes('script'),
      totalTransferBytes: resourceBytes(),
      undersizedPrimaryTargets,
      undersizedTargetCount,
    };
  });
}

async function mergeEvidence(
  viewport: (typeof targetViewports)[number],
  records: Array<Record<string, unknown>>,
  baseURL: string,
) {
  await mkdir(evidenceDirectory, { recursive: true });
  const evidencePath = resolve(evidenceDirectory, 'route-measurements.json');
  let priorRecords: Array<Record<string, unknown>> = [];
  try {
    const priorEvidence = JSON.parse(
      await readFile(evidencePath, 'utf8'),
    ) as { records?: Array<Record<string, unknown>> };
    priorRecords = priorEvidence.records ?? [];
  } catch {
    // The first capture creates the evidence file.
  }
  const mergedRecords = [
    ...priorRecords.filter(
      (record) => Number(record.width) !== viewport.width,
    ),
    ...records,
  ].sort(
    (left, right) =>
      Number(right.width) - Number(left.width)
      || String(left.id).localeCompare(String(right.id)),
  );
  await writeFile(
    evidencePath,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        origin: new URL(baseURL).origin,
        production: new URL(baseURL).origin === publicOrigin,
        records: mergedRecords,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

for (const viewport of targetViewports) {
  test(`Phase 5 primary routes retain mobile stability at ${viewport.width}px`, async ({
    baseURL,
    browser,
  }) => {
    test.slow();
    expect(baseURL).toBeTruthy();
    const records: Array<Record<string, unknown>> = [];

    for (const route of evidenceRoutes) {
      const { context, page } = await createMeasuredPage(
        browser,
        String(baseURL),
        viewport,
      );
      const failedRequests: string[] = [];
      const abortedPrefetches: string[] = [];
      const failedResponses: Array<{ status: number; url: string }> = [];
      page.on('requestfailed', (request) => {
        const requestUrl = request.url();
        if (new URL(requestUrl).searchParams.has('_rsc')) {
          abortedPrefetches.push(requestUrl);
          return;
        }
        failedRequests.push(requestUrl);
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          failedResponses.push({
            status: response.status(),
            url: response.url(),
          });
        }
      });

      try {
        const response = await page.goto(route.path, {
          waitUntil: 'networkidle',
        });
        const initialLoad = await measureInitialLoad(page);
        await page.keyboard.press('Escape');
        await warmPage(page);
        const metrics = await measurePage(page);
        const record = {
          id: route.id,
          path: route.path,
          ...viewport,
          responseStatus: response?.status() ?? null,
          releaseId: response?.headers()[releaseHeader] ?? null,
          htmlBytes: response ? (await response.body()).byteLength : null,
          abortedPrefetches,
          failedRequests,
          failedResponses,
          ...initialLoad,
          ...metrics,
        };
        records.push(record);

        expect(response?.status(), route.path).toBe(200);
        expect(record.overflow, `${route.path} overflow`).toBe(false);
        expect(record.cls, `${route.path} CLS`).toBeLessThanOrEqual(0.1);
        expect(
          record.firstContentfulPaintMs,
          `${route.path} first contentful paint`,
        ).toBeGreaterThan(0);
        expect(
          record.largestContentfulPaintMs,
          `${route.path} largest contentful paint`,
        ).toBeGreaterThan(0);
        expect(
          record.timeToFirstByteMs,
          `${route.path} time to first byte`,
        ).toBeGreaterThan(0);
        expect(record.mainCount, `${route.path} main landmarks`).toBe(1);
        expect(record.h1Count, `${route.path} H1 count`).toBe(1);
        expect(record.duplicateIds, `${route.path} duplicate IDs`).toEqual([]);
        expect(record.brokenImages, `${route.path} visible images`).toEqual([]);
        expect(
          record.undersizedPrimaryTargets,
          `${route.path} primary touch targets`,
        ).toEqual([]);
        expect(record.failedRequests, `${route.path} request failures`).toEqual(
          [],
        );
        expect(record.failedResponses, `${route.path} HTTP failures`).toEqual(
          [],
        );

        if (capture && screenshotRoutes.has(route.id)) {
          await mkdir(evidenceDirectory, { recursive: true });
          await page.screenshot({
            path: resolve(
              evidenceDirectory,
              `${route.id}-${viewport.width}-top.png`,
            ),
            fullPage: false,
          });
        }
      } finally {
        await context.close();
      }
    }

    if (capture) {
      await mergeEvidence(viewport, records, String(baseURL));
    }
  });
}

test('release identity and semantic route state survive cache-busted requests', async ({
  baseURL,
  request,
}) => {
  expect(baseURL).toBeTruthy();
  const production = new URL(String(baseURL)).origin === publicOrigin;
  const expectedRelease = process.env.MARKETING_EXPECTED_RELEASE_SHA
    ?.trim()
    .toLowerCase();
  const releaseIds = new Set<string>();

  for (const route of semanticParityRoutes) {
    for (const cacheBusted of [false, true]) {
      const separator = route.path.includes('?') ? '&' : '?';
      const path = cacheBusted
        ? `${route.path}${separator}phase6_release_check=${Date.now()}`
        : route.path;
      const response = await request.get(path);
      const releaseId = response.headers()[releaseHeader];
      const html = await response.text();
      const canonicalPath = new URL(route.path, publicOrigin).pathname;
      const canonicalHref =
        canonicalPath === '/' ? publicOrigin : `${publicOrigin}${canonicalPath}`;

      expect(response.status(), path).toBe(200);
      expect(releaseId, `${path} release identity`).toBeTruthy();
      expect(
        releaseId === 'local' || releaseShaPattern.test(releaseId),
        `${path} release identity format`,
      ).toBe(true);
      if (production) {
        expect(releaseId, `${path} production release identity`).toMatch(
          releaseShaPattern,
        );
      }
      if (expectedRelease) {
        expect(releaseId, `${path} expected release identity`).toBe(
          expectedRelease,
        );
      }
      releaseIds.add(releaseId);
      expect(
        (html.match(/<main\b/g) ?? []).length,
        `${path} main count`,
      ).toBe(1);
      expect(
        (html.match(/<h1\b/g) ?? []).length,
        `${path} H1 count`,
      ).toBe(1);
      expect(html, `${path} canonical`).toContain(
        `<link rel="canonical" href="${canonicalHref}"/>`,
      );
      if (!('hasFooter' in route) || route.hasFooter) {
        expect(html, `${path} current footer`).toContain(
          'id="footer-contact-heading"',
        );
      }

      for (const marker of route.requiredMarkers) {
        expect(html, `${path} should include ${marker}`).toContain(marker);
      }
      for (const marker of 'forbiddenMarkers' in route
        ? route.forbiddenMarkers
        : []) {
        expect(html, `${path} should exclude ${marker}`).not.toContain(marker);
      }
      for (const [marker, count] of 'exactMarkerCounts' in route
        ? route.exactMarkerCounts
        : []) {
        expect(
          html.split(marker).length - 1,
          `${path} should include ${count} instances of ${marker}`,
        ).toBe(count);
      }
    }
  }

  for (const retiredPath of [
    '/home-v2',
    '/home-experimental',
    '/home-project-finder',
  ]) {
    const response = await request.get(retiredPath, { maxRedirects: 0 });
    expect(response.status(), `${retiredPath} redirect status`).toBe(308);
    expect(
      new URL(response.headers().location, String(baseURL)).pathname,
      `${retiredPath} redirect destination`,
    ).toBe('/');
    if (retiredPath === '/home-project-finder') {
      expect(response.headers()['x-robots-tag']).toMatch(
        /noindex.*nofollow/i,
      );
    }
  }

  const sitemapResponse = await request.get('/sitemap.xml');
  const sitemap = await sitemapResponse.text();
  expect(sitemapResponse.status()).toBe(200);
  expect(sitemap).toContain(
    `${publicOrigin}/architects-designers-builders`,
  );
  expect(sitemap).not.toContain(`${publicOrigin}/home-v2`);
  expect(sitemap).not.toContain(`${publicOrigin}/home-experimental`);
  expect(sitemap).not.toContain(`${publicOrigin}/home-project-finder`);
  releaseIds.add(sitemapResponse.headers()[releaseHeader]);

  const robotsResponse = await request.get('/robots.txt');
  const robots = await robotsResponse.text();
  expect(robotsResponse.status()).toBe(200);
  expect(robots).toContain(`Sitemap: ${publicOrigin}/sitemap.xml`);
  releaseIds.add(robotsResponse.headers()[releaseHeader]);

  expect(
    [...releaseIds],
    'all normal and cache-busted route responses identify one release',
  ).toHaveLength(1);
});
