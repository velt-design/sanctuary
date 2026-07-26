import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import { buildEnquiryHref } from '../apps/marketing/lib/enquiryContext';
import { ENQUIRY_ATTACHMENT_ACCEPT } from '../apps/marketing/lib/enquiryAttachments';

const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
const captureLabel = process.env.MARKETING_PHASE_FOUR_CAPTURE?.trim();
const captureWidth = Number.parseInt(
  process.env.MARKETING_PHASE_FOUR_WIDTH ?? '',
  10,
);
const targetViewports = [
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;
const evidenceRoutes = [
  { id: 'home', path: '/' },
  { id: 'commercial', path: '/commercial-pergolas-auckland' },
  {
    id: 'professional-entry',
    path: '/contact?enquiry_type=professional&source_path=%2F&source_component=pathway',
  },
  { id: 'professional-route', path: '/architects-designers-builders' },
  { id: 'guide-hub', path: '/pergola-guides' },
  { id: 'outdoor-rooms', path: '/outdoor-rooms-auckland' },
  { id: 'aluminium', path: '/aluminium-pergolas-auckland' },
  { id: 'gable', path: '/gable-pergolas-auckland' },
  { id: 'pitched', path: '/pitched-pergolas-auckland' },
  { id: 'cost', path: '/pergola-cost-auckland' },
  { id: 'blinds', path: '/pergolas-with-blinds' },
  { id: 'acrylic-versus-louvre', path: '/acrylic-pergolas-vs-louvre-roofs' },
] as const;
const screenshotRoutes = new Set([
  'home',
  'commercial',
  'professional-entry',
  'professional-route',
  'guide-hub',
  'aluminium',
  'cost',
]);
const guideDetailRoutes = [
  {
    path: '/outdoor-rooms-auckland',
    projectSlug: 'warkworth-outdoor-room',
    projectCount: 4,
    returnHref: '/pergolas-auckland',
  },
  {
    path: '/aluminium-pergolas-auckland',
    projectSlug: 'dairy-flat-estate',
    projectCount: 4,
    returnHref: '/products',
  },
  {
    path: '/gable-pergolas-auckland',
    projectSlug: 'warkworth-outdoor-room',
    projectCount: 4,
    returnHref: '/products/pergolas/gable',
  },
  {
    path: '/pitched-pergolas-auckland',
    projectSlug: 'velskov-forest',
    projectCount: 4,
    returnHref: '/products/pergolas/pitched',
  },
  {
    path: '/pergola-cost-auckland',
    projectSlug: 'warkworth-outdoor-room',
    projectCount: 4,
    returnHref: '/pergolas-auckland',
  },
  {
    path: '/pergolas-with-blinds',
    projectSlug: 'tindalls-bay-pavilion',
    projectCount: 3,
    returnHref: '/products/screens-walls/drop-down-blinds',
  },
  {
    path: '/acrylic-pergolas-vs-louvre-roofs',
    projectSlug: 'mt-maunganui-box',
    projectCount: 4,
    returnHref: '/products',
  },
] as const;

async function readTextContrast(root: Locator) {
  return root.evaluate((element) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return {
        minimumRatio: 0,
        textRuns: 0,
        violations: ['Canvas colour conversion unavailable'],
      };
    }

    const toRgba = (value: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context
        .getImageData(0, 0, 1, 1)
        .data;
      return {
        alpha: alpha / 255,
        blue,
        green,
        red,
      };
    };
    const composite = (
      foreground: ReturnType<typeof toRgba>,
      background: ReturnType<typeof toRgba>,
    ) => ({
      blue:
        foreground.blue * foreground.alpha
        + background.blue * (1 - foreground.alpha),
      green:
        foreground.green * foreground.alpha
        + background.green * (1 - foreground.alpha),
      red:
        foreground.red * foreground.alpha
        + background.red * (1 - foreground.alpha),
    });
    const linearChannel = (value: number) => {
      const channel = value / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (
      colour: Pick<ReturnType<typeof toRgba>, 'red' | 'green' | 'blue'>,
    ) => (
      0.2126 * linearChannel(colour.red)
      + 0.7152 * linearChannel(colour.green)
      + 0.0722 * linearChannel(colour.blue)
    );
    const contrastRatio = (
      foreground: Pick<ReturnType<typeof toRgba>, 'red' | 'green' | 'blue'>,
      background: Pick<ReturnType<typeof toRgba>, 'red' | 'green' | 'blue'>,
    ) => {
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
        / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    };
    const effectiveBackground = (candidate: Element) => {
      let current: Element | null = candidate;
      while (current) {
        const value = getComputedStyle(current).backgroundColor;
        if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
          return value;
        }
        current = current.parentElement;
      }
      return 'rgb(255, 255, 255)';
    };

    const textRuns = [element, ...element.querySelectorAll('*')]
      .filter((candidate): candidate is HTMLElement => (
        candidate instanceof HTMLElement
        && candidate.checkVisibility()
        && [...candidate.childNodes].some(
          (node) => (
            node.nodeType === Node.TEXT_NODE
            && Boolean(node.textContent?.trim())
          ),
        )
      ))
      .map((candidate) => {
        const background = toRgba(effectiveBackground(candidate));
        const foreground = composite(
          toRgba(getComputedStyle(candidate).color),
          background,
        );
        return {
          label: [...candidate.childNodes]
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent?.trim())
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .slice(0, 80),
          ratio: contrastRatio(foreground, background),
        };
      });

    return {
      minimumRatio: Math.min(...textRuns.map(({ ratio }) => ratio)),
      textRuns: textRuns.length,
      violations: textRuns
        .filter(({ ratio }) => ratio < 4.5)
        .map(({ label, ratio }) => `${label}: ${ratio.toFixed(2)}`),
    };
  });
}

async function createMeasuredPage(
  browser: Browser,
  baseURL: string,
  viewport: (typeof targetViewports)[number],
) {
  const context = await browser.newContext({
    baseURL,
    viewport,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem(
      'sp_consent_v1',
      JSON.stringify({
        analytics: false,
        marketing: false,
        updatedAt: '2026-07-25T00:00:00.000Z',
        version: 1,
      }),
    );
    (window as typeof window & { __phaseFourCls?: number }).__phaseFourCls = 0;
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (!shift.hadRecentInput) {
          const measuredWindow = window as typeof window & {
            __phaseFourCls?: number;
          };
          measuredWindow.__phaseFourCls =
            (measuredWindow.__phaseFourCls ?? 0) + (shift.value ?? 0);
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  return { context, page: await context.newPage() };
}

async function warmPage(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(320, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolveStep) => setTimeout(resolveStep, 15));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
}

async function measurePage(page: Page) {
  return page.evaluate(() => {
    const wordCount = (value: string) => value.trim().match(/\S+/g)?.length ?? 0;
    const main = document.querySelector<HTMLElement>('main');
    const footer = document.querySelector<HTMLElement>('footer');
    const measuredWindow = window as typeof window & {
      __phaseFourCls?: number;
    };
    const visibleInteractive = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, summary, input:not([type="hidden"]), select, textarea',
      ),
    ].filter((element) => element.checkVisibility());
    const touchTargets = visibleInteractive.map((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        label:
          element.getAttribute('aria-label') ??
          element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ??
          element.tagName.toLowerCase(),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    });
    const undersizedTargets = touchTargets.filter(
      ({ width, height }) => width < 44 || height < 44,
    );
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const footerBounds = footer?.getBoundingClientRect();
    const mainChildren = main
      ? [...main.children].filter((element) =>
          element.matches('section, details, form, nav, article'),
        )
      : [];
    const guideReturn = main?.querySelector<HTMLElement>(
      '[data-guide-first-layer-return]',
    );
    const firstOptional = main?.querySelector<HTMLElement>(
      'details[data-guide-supporting-depth]',
    );
    const guideProject = main?.querySelector<HTMLElement>(
      '[data-guide-first-layer-project]',
    );

    return {
      cls: Number((measuredWindow.__phaseFourCls ?? 0).toFixed(4)),
      disclosureCount:
        main?.querySelectorAll(
          'details[data-mobile-disclosure], details[data-seo-landing-disclosure], details[data-guide-description]',
        ).length ?? 0,
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      footer: footer
        ? {
            height: Math.round(footer.scrollHeight),
            minHeight: footerStyle?.minHeight ?? null,
            phoneLinks: footer.querySelectorAll('a[href^="tel:"]').length,
            emailLinks: footer.querySelectorAll('a[href^="mailto:"]').length,
            navigationLinks: footer.querySelectorAll('nav a[href]').length,
            top: Math.round((footerBounds?.top ?? 0) + window.scrollY),
          }
        : null,
      guideDescriptionControls:
        main?.querySelectorAll('details[data-guide-description]').length ?? 0,
      guideFirstLayer: {
        projectCount:
          main?.querySelectorAll(
            '[data-guide-first-layer-project] .acrylic-project-card',
          ).length ??
          0,
        projectBeforeOptional:
          Boolean(guideProject && firstOptional) &&
          Boolean(
            guideProject!.compareDocumentPosition(firstOptional!) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        returnBeforeOptional:
          Boolean(guideReturn && firstOptional) &&
          Boolean(
            guideReturn!.compareDocumentPosition(firstOptional!) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ),
      },
      homepageRegions:
        main?.querySelectorAll('[data-home-section]').length ?? 0,
      imageElements: main?.querySelectorAll('img').length ?? 0,
      majorRegions: mainChildren.length,
      mainHeight: main ? Math.round(main.getBoundingClientRect().height) : 0,
      mainVisibleWords: main ? wordCount(main.innerText) : 0,
      minimumTouchHeight: touchTargets.length
        ? Math.min(...touchTargets.map(({ height }) => height))
        : null,
      minimumTouchWidth: touchTargets.length
        ? Math.min(...touchTargets.map(({ width }) => width))
        : null,
      undersizedTargetCount: undersizedTargets.length,
      undersizedTargets: undersizedTargets.slice(0, 20),
    };
  });
}

test('capture reproducible Phase 4 route measurements and screenshots', async ({
  baseURL,
  browser,
}) => {
  test.skip(
    captureLabel !== 'before' && captureLabel !== 'after',
    'Set MARKETING_PHASE_FOUR_CAPTURE=before or after to capture evidence.',
  );
  test.slow();
  expect(baseURL).toBeTruthy();

  const evidenceDirectory = resolve(
    `artifacts/mobile-ux-phase-4/${captureLabel}`,
  );
  await mkdir(evidenceDirectory, { recursive: true });
  const records: Array<Record<string, unknown>> = [];

  const captureViewports = Number.isFinite(captureWidth)
    ? targetViewports.filter(({ width }) => width === captureWidth)
    : targetViewports;
  expect(captureViewports.length, 'capture viewport selection').toBeGreaterThan(
    0,
  );

  for (const viewport of captureViewports) {
    for (const route of evidenceRoutes) {
      const { context, page } = await createMeasuredPage(
        browser,
        String(baseURL),
        viewport,
      );
      const imageRequestUrls: string[] = [];
      page.on('response', (response) => {
        if (response.request().resourceType() === 'image' && response.ok()) {
          imageRequestUrls.push(response.url());
        }
      });

      try {
        const response = await page.goto(route.path, {
          waitUntil: 'networkidle',
        });
        await warmPage(page);
        const metrics = await measurePage(page);
        const transferredImageBytes = await page.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .filter((entry) => entry.initiatorType === 'img')
            .reduce(
              (total, entry) =>
                total + (entry as PerformanceResourceTiming).transferSize,
              0,
            ),
        );

        records.push({
          id: route.id,
          path: route.path,
          ...viewport,
          responseStatus: response?.status() ?? null,
          htmlBytes: response ? (await response.body()).byteLength : null,
          imageRequests: imageRequestUrls.length,
          uniqueImageRequests: new Set(imageRequestUrls).size,
          transferredImageBytes,
          ...metrics,
        });

        if (screenshotRoutes.has(route.id)) {
          await page.screenshot({
            path: resolve(
              evidenceDirectory,
              `${route.id}-${viewport.width}-top.png`,
            ),
            fullPage: false,
          });
          if (viewport.width === 390) {
            await page.screenshot({
              path: resolve(evidenceDirectory, `${route.id}-390-full.png`),
              fullPage: true,
            });
            const footer = page.locator('footer');
            if (await footer.count()) {
              await footer.scrollIntoViewIfNeeded();
              await page.screenshot({
                path: resolve(
                  evidenceDirectory,
                  `${route.id}-390-footer.png`,
                ),
                fullPage: false,
              });
            }
          }
        }
      } finally {
        await context.close();
      }
    }
  }

  const evidencePath = resolve(evidenceDirectory, 'route-measurements.json');
  let priorRecords: Array<Record<string, unknown>> = [];
  try {
    const priorEvidence = JSON.parse(
      await (await import('node:fs/promises')).readFile(evidencePath, 'utf8'),
    ) as { records?: Array<Record<string, unknown>> };
    priorRecords = priorEvidence.records ?? [];
  } catch {
    // The first capture for a label creates the file.
  }
  const capturedWidths = new Set(captureViewports.map(({ width }) => width));
  const mergedRecords = [
    ...priorRecords.filter(
      (record) => !capturedWidths.has(Number(record.width)),
    ),
    ...records,
  ].sort(
    (left, right) =>
      Number(right.width) - Number(left.width) ||
      String(left.id).localeCompare(String(right.id)),
  );

  await writeFile(
    evidencePath,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        origin: new URL(String(baseURL)).origin,
        production: new URL(String(baseURL)).origin === publicOrigin,
        records: mergedRecords,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
});

test('commercial journey leads with three cases and three delivery stages', async ({
  page,
}) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);
    const response = await page.goto('/commercial-pergolas-auckland', {
      waitUntil: 'networkidle',
    });
    expect(response?.ok()).toBe(true);

    const main = page.locator(
      'main[data-seo-landing="commercial-pergolas-auckland"]',
    );
    await expect(main.locator('#commercial-projects .acrylic-project-card')).toHaveCount(
      3,
    );
    await expect(main.locator('#commercial-process li')).toHaveCount(3);
    await expect(
      main.locator(
        ':scope > details[data-seo-landing-disclosure="commercial-value-detail"], ' +
          ':scope > details[data-seo-landing-disclosure="commercial-coordination-detail"], ' +
          ':scope > details[data-seo-landing-disclosure="commercial-planning-support"]',
      ),
    ).toHaveCount(3);
    await expect(
      main.getByRole('navigation', { name: 'Pergola guide progression' }),
    ).toHaveCount(0);
    await expect(main.locator('#acrylic-enquiry-type')).toHaveValue('commercial');

    expect(
      await main.evaluate((element) => {
        const children = [...element.children];
        const heroIndex = children.findIndex((child) =>
          child.classList.contains('acrylic-hero'),
        );
        const formIndex = children.findIndex(
          (child) => child.id === 'project-details',
        );
        const journeyRegions = children
          .slice(heroIndex + 1, formIndex)
          .filter((child) => child.matches('section, details'));
        return {
          firstId:
            journeyRegions[0]?.id ??
            journeyRegions[0]?.querySelector('[id]')?.id ??
            null,
          count: journeyRegions.length,
          overflow:
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth + 1,
        };
      }),
    ).toEqual({
      firstId: 'commercial-projects',
      count: 6,
      overflow: false,
    });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/commercial-pergolas-auckland', {
    waitUntil: 'networkidle',
  });
  await expect(
    page.locator('header.site').getByRole('link', { name: 'Get an estimate' }),
  ).toHaveAttribute(
    'href',
    buildEnquiryHref({
      enquiryType: 'commercial',
      sourcePath: '/commercial-pergolas-auckland',
      sourceComponent: 'header',
    }),
  );
});

test('professional capability route is discoverable, governed and source aware', async ({
  page,
}) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);
    const response = await page.goto('/architects-designers-builders', {
      waitUntil: 'networkidle',
    });
    expect(response?.ok()).toBe(true);

    const main = page.locator(
      'main[data-seo-landing="architects-designers-builders"]',
    );
    await expect(
      main.getByRole('heading', {
        level: 1,
        name: 'Bring Sanctuary into the project at the right level.',
      }),
    ).toBeVisible();
    await expect(
      main.locator('#professional-projects .acrylic-project-card h3'),
    ).toHaveText([
      'KiwiRail Head Office',
      'Lilliput Mini Golf',
      'The Good Home Takanini',
    ]);
    await expect(main.locator('#professional-inputs article')).toHaveCount(3);
    await expect(
      main.locator('details[data-seo-landing-disclosure]'),
    ).toHaveCount(2);
    await expect(main.locator('#acrylic-enquiry-type')).toHaveValue(
      'professional',
    );
    await expect(main.locator('#acrylic-enquiry-files')).toHaveAttribute(
      'accept',
      ENQUIRY_ATTACHMENT_ACCEPT,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}/architects-designers-builders`,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(
      page
        .getByRole('navigation', { name: 'Mobile primary' })
        .getByRole('link', { name: 'Architects, designers & builders' }),
    ).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
  }

  await page.goto('/');
  await expect(
    page.locator(
      'a[data-homepage-event="professional_pathway_click"][href="/architects-designers-builders"]',
    ),
  ).toHaveCount(2);
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).toContainText(
    `${publicOrigin}/architects-designers-builders`,
  );
});

test('professional form submits canonical context without personal analytics properties', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'sp_consent_v1',
      JSON.stringify({
        analytics: true,
        marketing: false,
        updatedAt: '2026-07-25T00:00:00.000Z',
        version: 1,
      }),
    );
    (
      window as typeof window & {
        dataLayer?: Array<Record<string, unknown>>;
      }
    ).dataLayer = [];
  });
  let submittedPayload: Record<string, unknown> | null = null;
  await page.route('**/api/enquiry', async (route) => {
    submittedPayload = route.request().postDataJSON() as Record<
      string,
      unknown
    >;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/architects-designers-builders', {
    waitUntil: 'networkidle',
  });
  await page.locator('#acrylic-enquiry-suburb').fill('Greenlane');
  await page
    .locator('#acrylic-enquiry-message')
    .fill('Please review the canopy brief and the structural interfaces.');
  await page.locator('#acrylic-enquiry-name').fill('Phase Four Test Person');
  await page.locator('#acrylic-enquiry-phone').fill('022 000 0044');
  await page
    .locator('#acrylic-enquiry-organisationAndRole')
    .fill('Example Architects — project architect');
  await page
    .locator('#acrylic-enquiry-requestedScope')
    .fill('Design development, engineering coordination and installation.');
  await page
    .getByRole('button', { name: 'Send professional project brief' })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Thanks, we have received your project details.',
    }),
  ).toBeVisible();

  expect(submittedPayload).toMatchObject({
    enquiryType: 'professional',
    page: '/architects-designers-builders',
    projectDetails: {
      organisationAndRole: 'Example Architects — project architect',
      requestedScope:
        'Design development, engineering coordination and installation.',
    },
    enquiryContext: {
      enquiry_type: 'professional',
      source_path: '/architects-designers-builders',
      source_component: 'embedded_form',
    },
  });

  const leadEvent = await page.evaluate(() =>
    (
      window as typeof window & {
        dataLayer?: Array<Record<string, unknown>>;
      }
    ).dataLayer?.find(({ event }) => event === 'lead_submitted'),
  );
  expect(leadEvent).toMatchObject({
    event: 'lead_submitted',
    lead_event_id: (submittedPayload as Record<string, unknown>).submissionId,
    enquiry_type: 'professional',
    source_path: '/architects-designers-builders',
    source_component: 'embedded_form',
    event_category: 'contact',
    event_label: 'professional',
    landing_page: '/architects-designers-builders',
  });
  expect(JSON.stringify(leadEvent)).not.toContain('Phase Four Test Person');
  expect(JSON.stringify(leadEvent)).not.toContain('022 000 0044');
  expect(JSON.stringify(leadEvent)).not.toContain('Example Architects');
});

test('guide hub keeps all ten distinctions visible without repeated controls', async ({
  page,
}) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);
    await page.goto('/pergola-guides', { waitUntil: 'networkidle' });
    const main = page.locator('main[data-pergola-guide-hub]');
    await expect(main.locator('[data-guide-card]')).toHaveCount(10);
    await expect(main.locator('.guide-hub-card__summary:visible')).toHaveCount(
      10,
    );
    await expect(main.locator('details[data-guide-description]')).toHaveCount(0);
    await expect(main).not.toContainText('About this guide');
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
  }
});

test('seven guide routes share answer, one project, route back and optional depth', async ({
  page,
}) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);
    for (const guide of guideDetailRoutes) {
      const response = await page.goto(guide.path, {
        waitUntil: 'networkidle',
      });
      expect(response?.ok(), guide.path).toBe(true);
      const main = page.locator('main[data-seo-landing]');
      const firstLayerProject = main.locator(
        '[data-guide-first-layer-project]',
      );
      const routeBack = main.locator('[data-guide-first-layer-return]');
      const supportingDepth = main.locator(
        'details[data-guide-supporting-depth]',
      );

      await expect(
        main.locator(':scope > section.acrylic-section--opening .acrylic-prose > p'),
      ).toHaveCount(1);
      await expect(
        firstLayerProject.locator('.acrylic-project-card'),
      ).toHaveCount(1);
      await expect(
        firstLayerProject.locator(
          `.acrylic-project-card[href="/projects/${guide.projectSlug}"]`,
        ),
      ).toHaveCount(1);
      await expect(routeBack.locator(`a[href="${guide.returnHref}"]`)).toHaveCount(
        1,
      );
      await expect(supportingDepth).toHaveCount(1);
      await expect(supportingDepth).not.toHaveAttribute('open', '');
      await expect(main.locator('.acrylic-project-card')).toHaveCount(
        guide.projectCount,
      );
      expect(
        await main.evaluate((element) => {
          const project = element.querySelector(
            '[data-guide-first-layer-project]',
          );
          const routeBackElement = element.querySelector(
            '[data-guide-first-layer-return]',
          );
          const optional = element.querySelector(
            'details[data-guide-supporting-depth]',
          );
          if (!project || !routeBackElement || !optional) return false;
          return (
            Boolean(
              project.compareDocumentPosition(routeBackElement) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            ) &&
            Boolean(
              routeBackElement.compareDocumentPosition(optional) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            )
          );
        }),
      ).toBe(true);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      ).toBe(true);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pergola-cost-auckland', { waitUntil: 'networkidle' });
  const supportingDepth = page.locator(
    'details[data-guide-supporting-depth]',
  );
  await supportingDepth.locator(':scope > summary').click();
  await expect(supportingDepth).toHaveAttribute('open', '');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(supportingDepth).not.toHaveAttribute('open', '');
  await page.locator('[data-guide-first-layer-return] a').click();
  await expect(page).toHaveURL(/\/pergolas-auckland$/);
  await page.goBack({ waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/pergola-cost-auckland$/);
  await expect(page.locator('main[data-seo-landing]')).toBeVisible();
});

test('guide first layers remain complete without JavaScript', async ({
  baseURL,
  browser,
}) => {
  test.slow();
  expect(baseURL).toBeTruthy();
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    for (const guide of guideDetailRoutes) {
      const response = await page.goto(guide.path, { waitUntil: 'load' });
      expect(response?.ok(), guide.path).toBe(true);
      const main = page.locator('main[data-seo-landing]');
      await expect(main.locator('[data-guide-first-layer-project]')).toBeVisible();
      await expect(main.locator('[data-guide-first-layer-return]')).toBeVisible();
      await expect(
        main.locator('details[data-guide-supporting-depth]'),
      ).toHaveAttribute('open', '');
      await expect(main.locator('.acrylic-project-card')).toHaveCount(
        guide.projectCount,
      );
    }
  } finally {
    await context.close();
  }
});

test('homepage closes in seven regions and the footer stays compact and useful', async ({
  page,
}) => {
  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'networkidle' });
    const main = page.locator('main[data-homepage-variant="v2"]');
    const footer = page.locator('footer');

    await expect(main.locator('[data-home-section]')).toHaveCount(7);
    expect(
      await main
        .locator('[data-home-section]')
        .evaluateAll((sections) =>
          sections.map((section) => section.getAttribute('data-home-section')),
        ),
    ).toEqual([
      'hero',
      'featured-project',
      'project-pathways',
      'selected-projects',
      'planning-options',
      'design-build-process',
      'qualified-enquiry',
    ]);
    await expect(
      main.locator(
        '[data-home-section="planning-options"] details[data-mobile-disclosure]',
      ),
    ).toHaveCount(2);
    await expect(
      main.locator('details[data-mobile-disclosure]'),
    ).toHaveCount(5);
    await expect(
      main.locator('[data-home-section="client-review"]'),
    ).toHaveCount(0);
    await expect(
      main.locator('[data-home-section="qualified-enquiry"] [data-home-review]'),
    ).toHaveCount(1);
    await expect(
      main
        .getByRole('navigation', { name: 'Featured pergola guides' })
        .getByRole('link'),
    ).toHaveCount(2);

    await expect(footer.locator('a[href="tel:+64228545633"]')).toHaveText(
      '022 854 5633',
    );
    await expect(
      footer.locator('a[href="mailto:info@sanctuarypergolas.co.nz"]'),
    ).toHaveText('info@sanctuarypergolas.co.nz');
    await expect(
      footer.getByRole('navigation', { name: 'Footer navigation' }).getByRole(
        'link',
      ),
    ).toHaveCount(3);
    await expect(
      footer.getByRole('link', { name: 'Discuss your project' }),
    ).toHaveAttribute('href', '/contact');
    await expect(
      footer.getByRole('link', {
        name: '5.0 · 61 Google reviews',
        exact: true,
      }),
    ).toHaveAttribute('href', /search\.google\.com\/local\/reviews/);

    const footerState = await footer.evaluate((element) => {
      const style = getComputedStyle(element);
      const targets = [
        ...element.querySelectorAll<HTMLElement>('a[href], button'),
      ]
        .filter((target) => target.checkVisibility())
        .map((target) => {
          const bounds = target.getBoundingClientRect();
          return {
            height: Math.round(bounds.height),
            label:
              target.getAttribute('aria-label') ??
              target.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
            width: Math.round(bounds.width),
          };
        });
      return {
        height: Math.round(element.scrollHeight),
        minHeight: style.minHeight,
        undersized: targets.filter(
          ({ width, height }) => width < 44 || height < 44,
        ),
      };
    });
    expect(footerState.minHeight).toBe('0px');
    expect(footerState.undersized).toEqual([]);
    expect(footerState.height).toBeLessThan(900);
    const footerContrast = await readTextContrast(footer);
    expect(footerContrast.textRuns).toBeGreaterThan(0);
    expect(footerContrast.violations).toEqual([]);
    expect(footerContrast.minimumRatio).toBeGreaterThanOrEqual(4.5);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
  }
});
