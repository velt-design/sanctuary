import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  buildEnquiryHref,
  getEnquiryRouteContext,
  type EnquiryAudience,
  type EnquiryContext,
} from '../apps/marketing/lib/enquiryContext';

const route = '/contact';
const customRoute = `${route}?enquiry_type=residential&source_experience=project-finder-home-v1&project_direction=bespoke`;
const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
const phaseOneCapture = process.env.MARKETING_PHASE_ONE_CAPTURE?.trim();
const phaseOneEvidenceDirectory = path.join(
  process.cwd(),
  'artifacts',
  'mobile-ux-phase-1',
);
const consentChoice = {
  analytics: false,
  marketing: false,
  updatedAt: '2026-07-24T00:00:00.000Z',
  version: 1,
};

const contactCalculationRef = 'sc1.contact-playwright-reference';

function memberCentrePositions(widthMm: number, memberWidthMm: number, count: number) {
  const inset = memberWidthMm / 2 / widthMm;
  return Array.from(
    { length: count },
    (_, index) => inset + index / (count - 1) * (1 - inset * 2),
  );
}

async function mockSimpleCoverPrice(page: Page) {
  await page.route('**/api/simple-cover-price', async (requestRoute) => {
    const input = requestRoute.request().postDataJSON() as {
      widthMm: number;
      projectionMm: number;
      level: 'ground' | 'elevated';
      connection: 'fascia' | 'facade' | 'soffit';
    };
    const areaM2 = input.widthMm * input.projectionMm / 1_000_000;
    const postCount = Math.max(2, Math.ceil(input.widthMm / 4_000) + 1);
    await requestRoute.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        status: 'priced',
        input,
        areaM2,
        postCount,
        postSpacingMm: Math.round(input.widthMm / (postCount - 1)),
        plan: {
          postPositions: memberCentrePositions(input.widthMm, 100, postCount),
          rafterPositions: memberCentrePositions(
            input.widthMm,
            50,
            Math.max(2, Math.ceil((input.widthMm - 50) / 642) + 1),
          ),
        },
        price: { fromIncGst: 24_250, currency: 'NZD' },
        configuration: { versionNumber: 23 },
        calculationRef: contactCalculationRef,
      }),
    });
  });
}

async function preparePage(
  page: Page,
  options: { consent?: typeof consentChoice; reducedMotion?: boolean } = {},
) {
  await page.emulateMedia({
    reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference',
  });
  await page.addInitScript((choice) => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify(choice));
  }, options.consent ?? consentChoice);
}

async function expectNoOverflowOrNestedScroll(page: Page, main: Locator) {
  const evidence = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-contact-page]');
    const nestedScrollers = root
      ? [...root.querySelectorAll<HTMLElement>('*')]
          .filter((element) => {
            const style = getComputedStyle(element);
            return /(auto|scroll)/.test(style.overflowY)
              && element.scrollHeight > element.clientHeight + 1;
          })
          .map((element) => ({
            className: element.className,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
          }))
      : [];

    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      nestedScrollers,
    };
  });

  await expect(main).toBeVisible();
  expect(evidence.documentScrollWidth).toBeLessThanOrEqual(evidence.documentClientWidth);
  expect(evidence.bodyScrollWidth).toBeLessThanOrEqual(evidence.bodyClientWidth);
  expect(evidence.nestedScrollers).toEqual([]);
}

async function expectTouchSafe(main: Locator) {
  const undersized = await main
    .locator(
      [
        'a:visible',
        'button:visible',
        'input:not([type="radio"], [type="checkbox"]):not(.contact-form__honeypot input):visible',
        'select:visible',
        'textarea:visible',
        'label:has(input[type="radio"]:visible)',
        'label:has(input[type="checkbox"]:visible)',
      ].join(', '),
    )
    .evaluateAll((elements) => elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          height: Math.round(rect.height),
          label:
            element.getAttribute('aria-label')
            ?? element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 70)
            ?? element.tagName,
          width: Math.round(rect.width),
        };
      })
      .filter(({ height, width }) => height < 44 || width < 44));

  expect(undersized).toEqual([]);
}

for (const viewport of [
  { name: '320 mobile', width: 320, height: 844 },
  { name: '360 mobile', width: 360, height: 800 },
  { name: '390 mobile', width: 390, height: 844 },
  { name: '430 mobile', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const) {
  test(`contact is Foundation-aligned and usable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page, { reducedMotion: true });
    const hydrationErrors: string[] = [];
    page.on('console', (message) => {
      if (
        message.type() === 'error'
        && message.text().toLowerCase().includes('hydration')
      ) {
        hydrationErrors.push(message.text());
      }
    });
    const response = await page.goto(customRoute, {
      waitUntil: 'networkidle',
    });
    expect(response?.ok()).toBe(true);

    const main = page.locator('main[data-contact-page]');
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.getByRole('heading', {
      level: 1,
      name: 'Tell us about your project.',
    })).toBeVisible();
    await expect(main.getByRole('radio', { name: 'Custom design', exact: false }))
      .toBeChecked();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}${route}`,
    );
    await expect(page).toHaveTitle('Start Your Pergola Project | Sanctuary Pergolas');

    const earlyAction = main.getByRole('link', { name: 'Send a project brief' });
    await expect(earlyAction).toHaveAttribute('href', '#contact-form');
    if (viewport.width <= 430) {
      expect((await earlyAction.boundingBox())?.y ?? viewport.height)
        .toBeLessThan(viewport.height);
    }

    const heroImage = main.locator('.contact-hero__media img');
    await expect(heroImage).toHaveAttribute(
      'alt',
      'Freestanding matte black gable outdoor room beside a Warkworth home',
    );
    await expect.poll(() => heroImage.evaluate((image) =>
      (image as HTMLImageElement).complete
        ? (image as HTMLImageElement).naturalWidth
        : 0,
    )).toBeGreaterThan(0);
    expect(await heroImage.evaluate((image) => getComputedStyle(image).objectPosition))
      .toBe('50% 18%');

    const visibleFieldsWithoutLabels = await main
      .locator('input:visible:not([type="radio"], [type="checkbox"]), select:visible, textarea:visible')
      .evaluateAll((elements) => elements
        .filter((element) => {
          const id = element.id;
          return !id || !document.querySelector(`label[for="${CSS.escape(id)}"]`);
        })
        .map((element) => element.getAttribute('name')));
    expect(visibleFieldsWithoutLabels).toEqual([]);
    await expect(page.getByLabel('Name Required')).toHaveAttribute('autocomplete', 'name');
    await expect(page.getByLabel('Phone Required')).toHaveAttribute('inputmode', 'tel');
    await expect(page.getByLabel('Email Required')).toHaveAttribute('autocomplete', 'email');

    await expect(main).not.toContainText('—');
    const emDashDecorations = await main.locator('*').evaluateAll((elements) =>
      elements.reduce((count, element) => {
        const before = getComputedStyle(element, '::before').content;
        const after = getComputedStyle(element, '::after').content;
        return count + Number(before.includes('—')) + Number(after.includes('—'));
      }, 0),
    );
    expect(emDashDecorations).toBe(0);

    const transitions = await main.locator('.contact-action, .contact-form__type-options label')
      .evaluateAll((elements) => elements.map(
        (element) => getComputedStyle(element).transitionDuration,
      ));
    expect(transitions.every((duration) => duration === '0s')).toBe(true);

    await expectNoOverflowOrNestedScroll(page, main);
    await expectTouchSafe(main);
    expect(hydrationErrors).toEqual([]);
  });
}

test('trusted context preselects a pathway while generic residential and invalid values leave it open', async ({
  page,
  request,
}) => {
  await preparePage(page);

  for (const [value, audienceName] of [
    ['commercial', 'Organisation or venue'],
    ['professional', 'Architect, designer or builder'],
  ] as const) {
    const response = await request.get(`${route}?enquiry_type=${value}`);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toContain('value="commercial-professional"');

    await page.goto(`${route}?enquiry_type=${value}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('radio', { name: 'Commercial / Professional', exact: false })).toBeChecked();
    await expect(page.getByRole('radio', { name: audienceName, exact: false })).toBeChecked();
  }

  await page.goto(`${route}?enquiry=professional`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('radio', { name: 'Commercial / Professional', exact: false })).toBeChecked();
  await expect(page.getByRole('radio', {
    name: 'Architect, designer or builder',
    exact: false,
  })).toBeChecked();

  await page.goto(`${route}?enquiry_type=residential`, { waitUntil: 'networkidle' });
  expect(await page.locator('input[name="contactPathway"]').evaluateAll((radios) =>
    radios.every((radio) => !(radio as HTMLInputElement).checked),
  )).toBe(true);

  await page.goto(customRoute, { waitUntil: 'networkidle' });
  await expect(page.getByRole('radio', { name: 'Custom design', exact: false })).toBeChecked();

  await page.goto(
    `${route}?enquiry_type=residential&source_path=%2Fsimple-cover-calculator`,
    { waitUntil: 'networkidle' },
  );
  await expect(page.getByRole('radio', { name: 'Simple cover', exact: false })).toBeChecked();

  await page.goto(
    `${route}?enquiry_type=general&source_path=https%3A%2F%2Fevil.test&source_project=unknown`,
    { waitUntil: 'networkidle' },
  );
  expect(await page.locator('input[name="contactPathway"]').evaluateAll((radios) =>
    radios.every((radio) => !(radio as HTMLInputElement).checked),
  )).toBe(true);
  await expect(page.getByLabel('Enquiry context')).toHaveCount(0);
});

test('deliberate pathway choices reveal the next section on mobile only', async ({ page }) => {
  await preparePage(page, { reducedMotion: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route, { waitUntil: 'networkidle' });

  const simplePathway = page.getByRole('radio', { name: 'Simple cover', exact: false });
  await simplePathway.focus();
  await simplePathway.press('Space');
  await expect(simplePathway).toBeChecked();
  await expect.poll(() => page.locator('#contact-simple-calculator').evaluate((element) => (
    Math.round(element.getBoundingClientRect().top)
  ))).toBeGreaterThanOrEqual(64);
  await expect.poll(() => page.locator('#contact-simple-calculator').evaluate((element) => (
    Math.round(element.getBoundingClientRect().top)
  ))).toBeLessThanOrEqual(96);
  await expect(simplePathway).toBeFocused();

  const customPathway = page.getByRole('radio', { name: 'Custom design', exact: false });
  await customPathway.focus();
  await customPathway.press('Space');
  await expect(customPathway).toBeChecked();
  await expect.poll(() => page.locator('#contact-project-details').evaluate((element) => (
    Math.round(element.getBoundingClientRect().top)
  ))).toBeGreaterThanOrEqual(64);
  await expect.poll(() => page.locator('#contact-project-details').evaluate((element) => (
    Math.round(element.getBoundingClientRect().top)
  ))).toBeLessThanOrEqual(104);
  await expect(customPathway).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(route, { waitUntil: 'networkidle' });
  const desktopPathway = page.getByRole('radio', { name: 'Custom design', exact: false });
  await desktopPathway.focus();
  const desktopScrollBeforeSelection = await page.evaluate(() => window.scrollY);
  await desktopPathway.press('Space');
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  }));
  expect(await page.evaluate(() => window.scrollY)).toBe(desktopScrollBeforeSelection);
  await expect(desktopPathway).toBeFocused();
});

test('desktop Simple calculator gives the plan priority and keeps the result action comfortable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page, { reducedMotion: true });
  await mockSimpleCoverPrice(page);
  await page.goto(
    `${route}?enquiry_type=residential&source_path=%2Fsimple-cover-calculator`,
    { waitUntil: 'networkidle' },
  );

  const calculator = page.locator('[data-simple-cover-calculator]');
  const controls = calculator.locator('[data-calculator-controls]');
  const plan = calculator.locator('figure');
  const result = calculator.locator('[data-result-state="priced"]');
  const price = calculator.locator('[data-result-price]');
  const action = calculator.getByRole('link', { name: 'Request a site measure', exact: true });
  await expect(action).toBeVisible();

  const [controlsBox, planBox, resultBox, priceBox, actionBox] = await Promise.all([
    controls.boundingBox(),
    plan.boundingBox(),
    result.boundingBox(),
    price.boundingBox(),
    action.boundingBox(),
  ]);
  expect(controlsBox).not.toBeNull();
  expect(planBox).not.toBeNull();
  expect(resultBox).not.toBeNull();
  expect(priceBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(planBox!.width).toBeGreaterThan(controlsBox!.width * 1.8);
  expect(planBox!.height).toBeGreaterThan(resultBox!.height * 2);
  expect(resultBox!.height).toBeLessThanOrEqual(270);
  expect(actionBox!.width).toBeGreaterThanOrEqual(270);
  expect(actionBox!.height).toBeGreaterThanOrEqual(56);
  expect(actionBox!.x).toBeGreaterThan(priceBox!.x + priceBox!.width);

  await page.setViewportSize({ width: 1024, height: 900 });
  const [narrowPriceBox, narrowActionBox] = await Promise.all([
    price.boundingBox(),
    action.boundingBox(),
  ]);
  expect(narrowPriceBox).not.toBeNull();
  expect(narrowActionBox).not.toBeNull();
  expect(narrowActionBox!.y).toBeGreaterThan(narrowPriceBox!.y + narrowPriceBox!.height);
  expect(narrowActionBox!.width).toBeGreaterThanOrEqual(270);
  expect(narrowActionBox!.height).toBeGreaterThanOrEqual(56);
});

test('neutral, audience, project and product entry routes use one canonical contract', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await preparePage(page);

  await page.goto(route, { waitUntil: 'networkidle' });
  expect(await page.getByRole('radio').evaluateAll((radios) =>
    radios.every((radio) => !(radio as HTMLInputElement).checked),
  )).toBe(true);
  await expect(page.getByLabel('Enquiry context')).toHaveCount(0);

  type EntryCase = {
    name: string;
    route: string;
    context: EnquiryContext;
    audience?: EnquiryAudience;
    pathway?: 'commercial-professional';
    contextLabel: string;
    link: (currentPage: Page) => Locator;
  };
  const entryCases: EntryCase[] = [
    {
      name: 'residential service header',
      route: '/pergolas-auckland',
      context: {
        enquiryType: 'residential',
        sourcePath: '/pergolas-auckland',
        sourceComponent: 'header',
      },
      audience: 'residential',
      contextLabel: 'Residential project',
      link: (currentPage) => currentPage.locator('header.site')
        .getByRole('link', { name: 'Start your project' }),
    },
    {
      name: 'commercial service header',
      route: '/commercial-pergolas-auckland',
      context: {
        enquiryType: 'commercial',
        sourcePath: '/commercial-pergolas-auckland',
        sourceComponent: 'header',
      },
      audience: 'commercial',
      pathway: 'commercial-professional',
      contextLabel: 'Commercial project',
      link: (currentPage) => currentPage.locator('header.site')
        .getByRole('link', { name: 'Start your project' }),
    },
    {
      name: 'professional service header',
      route: '/architects-designers-builders',
      context: {
        enquiryType: 'professional',
        sourcePath: '/architects-designers-builders',
        sourceComponent: 'header',
      },
      audience: 'professional',
      pathway: 'commercial-professional',
      contextLabel: 'Professional project',
      link: (currentPage) => currentPage.locator('header.site')
        .getByRole('link', { name: 'Start your project' }),
    },
    {
      name: 'residential project CTA',
      route: '/projects/warkworth-outdoor-room',
      context: {
        enquiryType: 'residential',
        sourcePath: '/projects/warkworth-outdoor-room',
        sourceComponent: 'project_cta',
        sourceProject: 'warkworth-outdoor-room',
      },
      audience: 'residential',
      contextLabel: 'Project: Warkworth Outdoor Room',
      link: (currentPage) => currentPage.locator(
        '.project-case-study__intro-actions .project-action--primary',
      ),
    },
    {
      name: 'commercial project header',
      route: '/projects/goodhome-commercial-terrace',
      context: {
        ...getEnquiryRouteContext('/projects/goodhome-commercial-terrace'),
        sourcePath: '/projects/goodhome-commercial-terrace',
        sourceComponent: 'header',
      },
      audience: 'commercial',
      pathway: 'commercial-professional',
      contextLabel: 'Project: The Good Home Takanini',
      link: (currentPage) => currentPage.locator('header.site')
        .getByRole('link', { name: 'Start your project' }),
    },
    {
      name: 'neutral product CTA',
      route: '/products/pergolas/gable',
      context: {
        sourcePath: '/products/pergolas/gable',
        sourceComponent: 'product_cta',
        sourceProduct: 'gable',
      },
      contextLabel: 'Pergola option: Gable pergola',
      link: (currentPage) => currentPage.locator(
        'main[data-product-detail]',
      ).getByRole('link', { name: 'Send project brief' }).first(),
    },
  ];

  for (const entryCase of entryCases) {
    await page.goto(entryCase.route, { waitUntil: 'networkidle' });
    const link = entryCase.link(page);
    const expectedHref = buildEnquiryHref(entryCase.context);
    await expect(link, entryCase.name).toHaveAttribute('href', expectedHref);
    await link.click();
    await expect(page, entryCase.name).toHaveURL((currentUrl) =>
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` === expectedHref);
    const destination = new URL(page.url());
    expect(
      `${destination.pathname}${destination.search}${destination.hash}`,
      entryCase.name,
    ).toBe(expectedHref);
    await expect(page.getByLabel('Enquiry context')).toContainText(
      entryCase.contextLabel,
    );

    if (entryCase.pathway === 'commercial-professional') {
      await expect(page.getByRole('radio', {
        name: 'Commercial / Professional',
        exact: false,
      })).toBeChecked();
      await expect(page.getByRole('radio', {
        name: entryCase.audience === 'professional'
          ? 'Architect, designer or builder'
          : 'Organisation or venue',
        exact: false,
      })).toBeChecked();
    } else {
      expect(await page.locator('input[name="contactPathway"]').evaluateAll((radios) =>
        radios.every((radio) => !(radio as HTMLInputElement).checked),
      )).toBe(true);
    }
  }
});

test('validation is specific, focuses an error summary and preserves entered details', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route, { waitUntil: 'networkidle' });

  await page.getByRole('radio', { name: 'Custom design', exact: false }).check();
  const message = page.getByLabel('Project brief Optional');
  await message.fill('A sheltered dining area that keeps daylight in the kitchen.');
  await page.getByRole('button', { name: 'Send custom project brief' }).click();
  const summary = page.locator('#contact-error-summary');
  await expect(summary).toBeFocused();
  await expect(message).toHaveValue(
    'A sheltered dining area that keeps daylight in the kitchen.',
  );
  await expect(page.locator('#contact-name-error')).toHaveText('Enter your name.');
  await expect(summary).toBeFocused();
  await summary.getByRole('link', { name: 'Enter your name.' }).click();
  await expect(page.getByLabel('Name Required')).toBeFocused();

  await page.getByLabel('Name Required').fill('Test Person');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  await page.getByLabel('Email Required').fill('not-an-email');
  await page.getByRole('button', { name: 'Send custom project brief' }).click();
  await expect(page.locator('#contact-email-error')).toHaveText(
    'Enter a valid email address.',
  );
  await expect(summary).toBeFocused();
  await summary.getByRole('link', {
    name: 'Enter a valid email address.',
  }).click();
  await expect(page.getByLabel('Email Required')).toBeFocused();
});

test('direct form puts the useful first brief before optional technical detail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route, { waitUntil: 'networkidle' });

  await expect(page.getByRole('group', { name: '01 Choose your pathway Required' })).toBeVisible();
  await page.getByRole('radio', { name: 'Custom design', exact: false }).check();
  await expect(page.getByLabel('Name Required')).toHaveAttribute('required', '');
  await expect(page.getByLabel('Phone Required')).toHaveAttribute('required', '');
  await expect(page.getByLabel('Email Required')).toHaveAttribute('required', '');
  await expect(page.getByLabel('Project suburb Optional')).not.toHaveAttribute('required', '');
  await expect(page.getByLabel('Project brief Optional')).not.toHaveAttribute('required', '');
  await expect(page.locator('#contact-form')).toHaveAttribute('method', 'post');
  await expect(page.locator('#contact-form')).toHaveAttribute(
    'action',
    '/api/enquiry/fallback',
  );
  await expect(page.locator('#contact-form input[name="page"]')).toHaveValue('/contact');
  await expect(page.locator('#contact-form input[name="enquiryContext"]')).toHaveValue(
    JSON.stringify({ enquiry_type: 'residential' }),
  );

  const orderedFields = [
    '#contact-pathway-simple',
    '#contact-suburb',
    '#contact-message',
    '#contact-name',
    '#contact-phone',
    '#contact-email',
    '#contact-width',
  ];
  expect(await page.locator(orderedFields.join(', ')).evaluateAll((fields) => (
    fields.map((field) => `#${field.id}`)
  ))).toEqual(orderedFields);

  await expect(page.locator('#contact-files')).toBeVisible();
  await expect(page.locator('#contact-files')).toHaveAttribute(
    'accept',
    '.pdf,.jpg,.jpeg,.png,.webp',
  );
  await expect(page.getByText(
    'Up to 8 PDF, JPG, JPEG, PNG or WebP files, 20 MB total.',
    { exact: true },
  )).toBeVisible();
  const optionalDetails = page.getByText('Additional project details', { exact: true });
  await expect(optionalDetails).toBeVisible();
  const optionalSummary = page.locator('.contact-form__optional > summary');
  await expect(optionalSummary).toContainText('04');
  await expect(optionalSummary).toContainText('Optional');
  expect((await optionalSummary.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('group', { name: 'Roof Optional' })).toBeHidden();
  await optionalDetails.click();
  await expect(page.getByRole('group', { name: 'Roof Optional' })).toBeVisible();
});

test('Simple cover carries the secure priced configuration into the shared enquiry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await mockSimpleCoverPrice(page);
  let submittedBody: Record<string, unknown> | null = null;
  await page.route('**/api/enquiry', async (requestRoute) => {
    submittedBody = requestRoute.request().postDataJSON() as Record<string, unknown>;
    await requestRoute.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto(`${route}?enquiry_type=residential&source_path=%2Fsimple-cover-calculator`);
  await expect(page.getByRole('radio', { name: 'Simple cover', exact: false })).toBeChecked();
  const calculatorContinue = page.getByRole('link', { name: 'Request a site measure', exact: true });
  await expect(calculatorContinue).toBeVisible();
  await calculatorContinue.click();

  const summary = page.locator('[data-simple-cover-enquiry-summary="priced"]');
  await expect(summary).toContainText('From $24,250');
  await expect(summary).toContainText('6.0 m × 3.0 m');
  await page.getByLabel('Name Required').fill('Test Customer');
  await page.getByLabel('Phone Required').fill('021 234 5678');
  await page.getByLabel('Email Required').fill('test@example.com');
  await page.getByRole('button', { name: 'Request a site measure', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Request received.');

  expect(submittedBody).toMatchObject({
    enquiryType: 'residential',
    calculationRef: contactCalculationRef,
    simpleCoverStatus: 'priced',
    dimensions: { widthM: null, depthM: null, heightM: null },
    projectDetails: {
      contactPathway: 'simple',
      simpleCover: { status: 'priced', calculationAttached: true },
    },
  });
  expect(page.url()).not.toContain(contactCalculationRef);
  expect(page.url()).not.toContain('test%40example.com');
});

test('switching pathways retains shared fields and excludes branch-only values', async ({
  page,
}) => {
  await preparePage(page);
  let submittedBody: Record<string, unknown> | null = null;
  await page.route('**/api/enquiry', async (requestRoute) => {
    submittedBody = requestRoute.request().postDataJSON() as Record<string, unknown>;
    await requestRoute.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto(route);

  await page.getByRole('radio', { name: 'Commercial / Professional', exact: false }).check();
  await page.getByRole('radio', { name: 'Architect, designer or builder', exact: false }).check();
  await page.getByLabel('Project suburb Optional').fill('Grey Lynn');
  await page.getByLabel('Project scope Optional').fill('A coordinated project scope.');
  await page.getByLabel('Name Required').fill('Project Lead');
  await page.getByLabel('Phone Required').fill('021 234 5678');
  await page.getByLabel('Email Required').fill('lead@example.com');
  await page.getByLabel('Organisation or practice Optional').fill('Studio North');
  await page.getByLabel('Your role Optional').selectOption('architect-designer');
  await page.getByLabel('Project stage Optional').selectOption('concept-design');

  await page.getByRole('radio', { name: 'Custom design', exact: false }).check();
  await expect(page.getByLabel('Project suburb Optional')).toHaveValue('Grey Lynn');
  await expect(page.getByLabel('Name Required')).toHaveValue('Project Lead');
  await expect(page.getByLabel('Project brief Optional')).toHaveValue('A coordinated project scope.');
  await expect(page.locator('#contact-company')).toHaveCount(0);
  await expect(page.locator('#contact-role')).toHaveCount(0);
  await page.getByRole('button', { name: 'Send custom project brief' }).click();
  await expect(page.getByRole('status')).toContainText('Project brief sent.');

  expect(submittedBody).toMatchObject({
    enquiryType: 'residential',
    company: null,
    suburb: 'Grey Lynn',
    message: 'A coordinated project scope.',
    dimensions: { widthM: null, depthM: null, heightM: null },
    projectDetails: {
      contactPathway: 'custom',
    },
  });
  expect((submittedBody as Record<string, Record<string, unknown>>).projectDetails)
    .not.toHaveProperty('projectRole');
});

test('no-JavaScript fallback keeps personal data out of the URL and uses native validation', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    await page.goto(
      `${route}?enquiry_type=commercial&source_path=%2Fprojects%2Fgoodhome-commercial-terrace&source_component=project_cta`,
    );
    const form = page.locator('#contact-form');
    await expect(form).toHaveAttribute('method', 'post');
    await expect(form).toHaveAttribute('action', '/api/enquiry/fallback');
    await expect(form).not.toHaveAttribute('novalidate', '');
    await expect(page.locator('#contact-files')).toBeDisabled();
    await expect(page.getByText('File upload needs JavaScript.')).toBeVisible();
    await expect(form.locator('input[name="enquiryContext"]')).toHaveValue(
      JSON.stringify({
        enquiry_type: 'commercial',
        source_path: '/projects/goodhome-commercial-terrace',
        source_component: 'project_cta',
      }),
    );

    const phone = page.getByLabel('Phone Required');
    await phone.fill('x');
    expect(await phone.evaluate(
      (input: HTMLInputElement) => input.validity.patternMismatch,
    )).toBe(true);
    await phone.fill('022 854 5633');
    expect(await phone.evaluate(
      (input: HTMLInputElement) => input.validity.patternMismatch,
    )).toBe(false);

    await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
    await expect(page).toHaveURL(/\/contact\?/);
    expect(await page.getByLabel('Name Required').evaluate(
      (input: HTMLInputElement) => input.validationMessage,
    )).not.toBe('');
  } finally {
    await context.close();
  }
});

test('API errors keep values and retries reuse the submission UUID', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page, {
    consent: { ...consentChoice, marketing: true },
  });
  const payloads: Array<Record<string, unknown>> = [];
  await page.route('**/api/enquiry', async (handler) => {
    payloads.push(handler.request().postDataJSON() as Record<string, unknown>);
    const isRetry = payloads.length > 1;
    await handler.fulfill({
      status: isRetry ? 200 : 503,
      contentType: 'application/json',
      body: JSON.stringify(
        isRetry ? { ok: true } : { ok: false, error: 'Enquiry service unavailable' },
      ),
    });
  });
  await page.goto(
    `${route}?enquiry_type=residential&source_path=%2F&source_component=hero&utm_source=test&gclid=click-123`,
    {
    waitUntil: 'networkidle',
    },
  );
  await page.getByRole('radio', { name: 'Custom design', exact: false }).check();
  await page.getByLabel('Name Required').fill('Test Person');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  await page.getByLabel('Email Required').fill('test@example.com');
  await page.getByLabel('Project brief Optional').fill('Keep this project brief.');
  await page.getByRole('button', { name: 'Send custom project brief' }).click();

  const alert = page.locator('.contact-form__submit-error');
  await expect(alert).toContainText('Enquiry service unavailable');
  await expect(alert).toBeFocused();
  await expect(page.getByLabel('Name Required')).toHaveValue('Test Person');
  await expect(page.getByLabel('Project brief Optional'))
    .toHaveValue('Keep this project brief.');

  await page.getByRole('button', { name: 'Send custom project brief' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Project brief sent.',
  );
  await expect(page.getByRole('status')).toBeFocused();
  await expect(page.getByLabel('Name Required')).toHaveValue('Test Person');
  await expect(page.getByLabel('Project brief Optional')).toHaveValue(
    'Keep this project brief.',
  );
  expect(payloads).toHaveLength(2);
  expect(payloads[0]?.submissionId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(payloads[0]?.submissionId).toBe(payloads[1]?.submissionId);
  expect(payloads[0]).toMatchObject({
    enquiryType: 'residential',
    name: 'Test Person',
    email: 'test@example.com',
    phone: '021 000 0000',
    message: 'Keep this project brief.',
    page: route,
    source: 'website',
    enquiryContext: {
      enquiry_type: 'residential',
      source_path: '/',
      source_component: 'hero',
    },
    utm: { utm_source: 'test' },
    attribution: { clickIds: { gclid: 'click-123' } },
  });
});

test('the submit lock prevents duplicate requests and consent controls lead events', async ({
  page,
}) => {
  await preparePage(page, {
    consent: { ...consentChoice, analytics: true, marketing: true },
  });
  await page.addInitScript(() => {
    const tracked: Array<unknown[]> = [];
    (window as typeof window & { __tracked?: Array<unknown[]> }).__tracked = tracked;
    (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag =
      (...args: unknown[]) => tracked.push(['gtag', ...args]);
    (window as typeof window & { fbq?: (...args: unknown[]) => void }).fbq =
      (...args: unknown[]) => tracked.push(['fbq', ...args]);
  });
  let requestCount = 0;
  let submittedPayload: Record<string, unknown> | null = null;
  await page.route('**/api/enquiry', async (handler) => {
    requestCount += 1;
    submittedPayload = handler.request().postDataJSON() as Record<string, unknown>;
    await new Promise((resolve) => setTimeout(resolve, 200));
    await handler.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto(
    `${route}?enquiry_type=residential&source_path=%2F&source_component=hero`,
    { waitUntil: 'networkidle' },
  );
  await page.getByRole('radio', { name: 'Custom design', exact: false }).check();
  await page.getByLabel('Name Required').fill('Test Person');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  await page.getByLabel('Email Required').fill('test@example.com');

  const submit = page.getByRole('button', { name: 'Send custom project brief' });
  await submit.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByRole('status')).toContainText('Project brief sent.');
  expect(requestCount).toBe(1);

  const events = await page.evaluate(() => ({
    dataLayer: (window as typeof window & {
      dataLayer?: Array<Record<string, unknown>>;
    }).dataLayer,
    tracked: (window as typeof window & { __tracked?: Array<unknown[]> }).__tracked,
  }));
  expect(events.dataLayer?.filter((event) => event.event === 'lead_submitted'))
    .toHaveLength(1);
  expect(
    events.dataLayer?.find((event) => event.event === 'lead_submitted'),
  ).toMatchObject({
    lead_event_id: (submittedPayload as Record<string, unknown>).submissionId,
  });
  expect(events.tracked?.some((entry) => entry.includes('contact_start'))).toBe(true);
  expect(events.tracked?.some((entry) => entry.includes('contact_success'))).toBe(true);
  expect(JSON.stringify(events)).toContain('"source_path":"/"');
  expect(JSON.stringify(events)).toContain('"source_component":"hero"');
  expect(JSON.stringify(events)).toContain('"enquiry_type":"residential"');
  expect(JSON.stringify(events)).not.toContain('"enquiry_type":"Residential"');
  expect(JSON.stringify(events)).not.toContain('"enquiry_type":"Unknown"');
  expect(JSON.stringify(events)).not.toContain('Test Person');
});

test('residential attachments keep exact policy errors and fail visibly when upload signing is unavailable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  let submittedBody: Record<string, unknown> | undefined;
  let requestCount = 0;
  await page.route('**/api/enquiry/attachments/sign', async (handler) => {
    await handler.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Upload signing unavailable' }),
    });
  });
  await page.route('**/api/enquiry', async (handler) => {
    requestCount += 1;
    submittedBody = handler.request().postDataJSON() as Record<string, unknown>;
    await handler.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto(`${route}?enquiry_type=residential`, { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: 'Custom design', exact: false }).check();
  await page.getByLabel('Name Required').fill('Test Homeowner');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  await page.getByLabel('Email Required').fill('test@example.com');

  const files = page.getByLabel('Photos, plans or sketches Optional');
  await files.evaluate((input) => {
    const oversized = new File(
      [new Uint8Array(20 * 1024 * 1024 + 1)],
      'oversized-plan.pdf',
      { type: 'application/pdf' },
    );
    const transfer = new DataTransfer();
    transfer.items.add(oversized);
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#contact-files-error')).toHaveText(
    'Each file must be larger than 0 bytes and no larger than 20 MB.',
  );
  await page.getByRole('button', { name: 'Send custom project brief' }).click();
  expect(requestCount).toBe(0);
  const summary = page.locator('#contact-error-summary');
  await expect(summary).toBeFocused();
  await summary.getByRole('link', {
    name: 'Each file must be larger than 0 bytes and no larger than 20 MB.',
  }).click();
  await expect(files).toBeFocused();

  await files.setInputFiles({
    name: 'payload.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('invalid'),
  });
  await expect(page.locator('#contact-files-error')).toHaveText(
    'Attachments must be PDF, JPG, PNG, or WebP files with matching file extensions.',
  );
  await page.getByRole('button', { name: 'Send custom project brief' }).click();
  expect(requestCount).toBe(0);
  await expect(summary).toBeFocused();
  await summary.getByRole('link', {
    name: 'Attachments must be PDF, JPG, PNG, or WebP files with matching file extensions.',
  }).click();
  await expect(files).toBeFocused();

  await files.setInputFiles({
    name: 'plan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-test'),
  });
  await expect(page.getByRole('list', { name: 'Selected files' })).toContainText(
    'plan.pdf',
  );
  await page.getByRole('button', { name: 'Send custom project brief' }).click();
  await expect(page.locator('.contact-form__submit-error')).toContainText(
    'We could not upload your attachments. Please try again or remove them before submitting.',
  );
  expect(requestCount).toBe(0);
  expect(submittedBody).toBeUndefined();
  await expect(page.getByRole('list', { name: 'Selected files' })).toContainText(
    'plan.pdf',
  );
});

test('project context survives refresh and browser history', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto('/projects/warkworth-outdoor-room', { waitUntil: 'networkidle' });

  await page.locator(
    '.project-case-study__intro-actions .project-action--primary',
  ).click();
  await expect(page).toHaveURL(/enquiry_type=residential/);
  await expect(page).toHaveURL(/source_project=warkworth-outdoor-room/);
  await expect(page.getByLabel('Enquiry context')).toContainText(
    'Project: Warkworth Outdoor Room',
  );
  expect(await page.locator('input[name="contactPathway"]').evaluateAll((radios) =>
    radios.every((radio) => !(radio as HTMLInputElement).checked),
  )).toBe(true);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByLabel('Enquiry context')).toContainText(
    'Project: Warkworth Outdoor Room',
  );

  await page.goBack({ waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/projects\/warkworth-outdoor-room$/);
  await page.goForward({ waitUntil: 'networkidle' });
  await expect(page.getByLabel('Enquiry context')).toContainText(
    'Project: Warkworth Outdoor Room',
  );
});

test('product context is visible and included in the submitted payload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  let submittedBody: Record<string, unknown> | undefined;
  await page.route('**/api/enquiry', async (handler) => {
    submittedBody = handler.request().postDataJSON() as Record<string, unknown>;
    await handler.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/products/pergolas/gable', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Send project brief' }).first().click();
  await expect(page.getByLabel('Enquiry context')).toContainText(
    'Pergola option: Gable pergola',
  );
  expect(await page.locator('input[name="contactPathway"]').evaluateAll((radios) =>
    radios.every((radio) => !(radio as HTMLInputElement).checked),
  )).toBe(true);
  await page.getByRole('radio', { name: 'Commercial / Professional', exact: false }).check();
  await page.getByRole('radio', { name: 'Organisation or venue', exact: false }).check();
  await page.getByLabel('Name Required').fill('Test Person');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  await page.getByLabel('Email Required').fill('test@example.com');
  await page.getByRole('button', { name: 'Send project brief' }).click();
  await expect(page.getByRole('status')).toContainText('Project brief sent.');

  expect(submittedBody).toMatchObject({
    enquiryType: 'commercial',
    enquiryContext: {
      enquiry_type: 'commercial',
      source_path: '/products/pergolas/gable',
      source_component: 'product_cta',
      source_product: 'gable',
    },
  });
});

test('form semantics exclude the honeypot and keep IDs and error associations valid', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await preparePage(page);
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: 'Commercial / Professional', exact: false }).check();

  const duplicateIds = await page.locator('[id]').evaluateAll((elements) => {
    const counts = new Map<string, number>();
    for (const element of elements) {
      counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id);
  });
  expect(duplicateIds).toEqual([]);

  const honeypot = page.locator('#contact-website');
  await expect(honeypot).not.toBeInViewport();
  await expect(honeypot).toHaveAttribute('tabindex', '-1');
  await expect(honeypot.locator('xpath=..')).toHaveAttribute('aria-hidden', 'true');

  await page.getByRole('button', { name: 'Send project brief' }).click();
  const typeErrorId = await page.locator('fieldset.contact-form__type')
    .getAttribute('aria-describedby');
  expect(typeErrorId).toBe('contact-enquiryType-error');
  await expect(page.locator(`#${typeErrorId}`)).toContainText('Choose who is enquiring.');
});

test('contact form fragments clear the fixed header at mobile and desktop widths', async ({
  page,
}) => {
  await preparePage(page);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto(
      `${route}?enquiry_type=commercial&source_path=%2Fprojects%2Fgoodhome-commercial-terrace&source_component=project_cta&source_project=goodhome-commercial-terrace#contact-form`,
      { waitUntil: 'networkidle' },
    );

    const header = page.locator('header.site');
    const form = page.locator('#contact-form');
    await expect(form).toBeVisible();
    await expect(form.getByRole('heading', { name: 'Choose the right starting point.' })).toBeVisible();

    const [headerBounds, formBounds] = await Promise.all([
      header.boundingBox(),
      form.boundingBox(),
    ]);
    expect(headerBounds).not.toBeNull();
    expect(formBounds).not.toBeNull();
    expect(formBounds!.y).toBeGreaterThanOrEqual(
      headerBounds!.y + headerBounds!.height + 8,
    );
    expect(formBounds!.y).toBeLessThanOrEqual(
      headerBounds!.y + headerBounds!.height + 32,
    );
  }
});

test('capture Phase 1 enquiry continuity at the target mobile widths', async ({ page }) => {
  test.skip(!phaseOneCapture, 'Set MARKETING_PHASE_ONE_CAPTURE=1 to capture Phase 1 evidence.');
  await mkdir(phaseOneEvidenceDirectory, { recursive: true });
  await preparePage(page);

  for (const width of [360, 390, 430] as const) {
    await page.setViewportSize({ width, height: 932 });
    await page.goto(
      `${route}?enquiry_type=commercial&source_path=%2Fprojects%2Fgoodhome-commercial-terrace&source_component=header&source_project=goodhome-commercial-terrace#contact-form`,
      { waitUntil: 'networkidle' },
    );
    const form = page.locator('#contact-form');
    await expect(form).toBeVisible();
    await expect(page.getByLabel('Enquiry context')).toContainText(
      'Project: The Good Home Takanini',
    );
    await form.screenshot({
      path: path.join(phaseOneEvidenceDirectory, `contact-context-${width}.png`),
    });
  }
});
