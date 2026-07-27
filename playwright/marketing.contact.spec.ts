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
    const response = await page.goto(`${route}?enquiry_type=residential`, {
      waitUntil: 'networkidle',
    });
    expect(response?.ok()).toBe(true);

    const main = page.locator('main[data-contact-page]');
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.getByRole('heading', {
      level: 1,
      name: 'Tell us about the space you want to cover.',
    })).toBeVisible();
    await expect(main.getByRole('radio', { name: 'Residential', exact: false }))
      .toBeChecked();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}${route}`,
    );
    await expect(page).toHaveTitle('Start Your Pergola Project | Sanctuary Pergolas');

    const earlyAction = main.getByRole('link', { name: 'Start your project brief' });
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
    await expect(page.getByLabel('Email Optional')).toHaveAttribute('autocomplete', 'email');

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

test('canonical and legacy preselection are server rendered and invalid values leave the chooser open', async ({
  page,
  request,
}) => {
  await preparePage(page);

  for (const [value, name] of [
    ['residential', 'Residential'],
    ['commercial', 'Commercial'],
    ['professional', 'Architect, designer or builder'],
  ] as const) {
    const response = await request.get(`${route}?enquiry_type=${value}`);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toMatch(
      new RegExp(`<input[^>]*name="enquiryType"[^>]*checked=""[^>]*value="${value}"`),
    );

    await page.goto(`${route}?enquiry_type=${value}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('radio', { name, exact: false })).toBeChecked();
  }

  await page.goto(`${route}?enquiry=professional`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('radio', {
    name: 'Architect, designer or builder',
    exact: false,
  })).toBeChecked();

  await page.goto(
    `${route}?enquiry_type=general&source_path=https%3A%2F%2Fevil.test&source_project=unknown`,
    { waitUntil: 'networkidle' },
  );
  expect(await page.getByRole('radio').evaluateAll((radios) =>
    radios.every((radio) => !(radio as HTMLInputElement).checked),
  )).toBe(true);
  await expect(page.getByLabel('Enquiry context')).toHaveCount(0);
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

  await page.goto('/', { waitUntil: 'networkidle' });
  const professionalPathway = page.getByRole('link', {
    name: 'Work with Sanctuary',
  });
  await expect(professionalPathway).toHaveAttribute(
    'href',
    '/architects-designers-builders',
  );
  await professionalPathway.click();
  await expect(page).toHaveURL('/architects-designers-builders');
  await expect(page.locator('[data-seo-landing="architects-designers-builders"]'))
    .toBeVisible();

  type EntryCase = {
    name: string;
    route: string;
    context: EnquiryContext;
    audience?: EnquiryAudience;
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
      contextLabel: 'Residential enquiry',
      link: (currentPage) => currentPage.locator('header.site')
        .getByRole('link', { name: 'Get an estimate' }),
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
      contextLabel: 'Commercial enquiry',
      link: (currentPage) => currentPage.locator('header.site')
        .getByRole('link', { name: 'Get an estimate' }),
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
      contextLabel: 'Professional enquiry',
      link: (currentPage) => currentPage.locator('header.site')
        .getByRole('link', { name: 'Get an estimate' }),
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
      contextLabel: 'Project: The Good Home Takanini',
      link: (currentPage) => currentPage.locator('header.site')
        .getByRole('link', { name: 'Get an estimate' }),
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
      ).getByRole('link', { name: 'Send your project details' }).first(),
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

    if (entryCase.audience) {
      await expect(page.getByRole('radio', {
        name: entryCase.audience === 'professional'
          ? 'Architect, designer or builder'
          : entryCase.audience[0]!.toUpperCase() + entryCase.audience.slice(1),
        exact: false,
      })).toBeChecked();
    } else {
      expect(await page.getByRole('radio').evaluateAll((radios) =>
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

  const message = page.getByLabel('Project brief Optional');
  await message.fill('A sheltered dining area that keeps daylight in the kitchen.');
  await page.getByRole('button', { name: 'Send us your project details' }).click();
  await expect(page.locator('#contact-enquiryType-error')).toHaveText(
    'Choose a project type.',
  );
  const summary = page.locator('#contact-error-summary');
  await expect(summary).toBeFocused();
  await expect(message).toHaveValue(
    'A sheltered dining area that keeps daylight in the kitchen.',
  );
  await summary.getByRole('link', { name: 'Choose a project type.' }).click();
  await expect(page.getByRole('radio').first()).toBeFocused();

  await page.getByRole('radio', { name: 'Residential', exact: false }).check();
  await page.getByRole('button', { name: 'Send us your project details' }).click();
  await expect(page.locator('#contact-name-error')).toHaveText('Enter your name.');
  await expect(summary).toBeFocused();
  await summary.getByRole('link', { name: 'Enter your name.' }).click();
  await expect(page.getByLabel('Name Required')).toBeFocused();

  await page.getByLabel('Name Required').fill('Test Person');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  await page.getByLabel('Email Optional').fill('not-an-email');
  await page.getByRole('button', { name: 'Send us your project details' }).click();
  await expect(page.locator('#contact-email-error')).toHaveText(
    'Enter a valid email address or leave this field blank.',
  );
  await expect(summary).toBeFocused();
  await summary.getByRole('link', {
    name: 'Enter a valid email address or leave this field blank.',
  }).click();
  await expect(page.getByLabel('Email Optional')).toBeFocused();
});

test('direct form puts the useful first brief before optional technical detail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route, { waitUntil: 'networkidle' });

  await expect(page.getByRole('group', { name: 'Project type Required' })).toBeVisible();
  await expect(page.getByLabel('Name Required')).toHaveAttribute('required', '');
  await expect(page.getByLabel('Phone Required')).toHaveAttribute('required', '');
  await expect(page.getByLabel('Suburb Optional')).not.toHaveAttribute('required', '');
  await expect(page.getByLabel('Project brief Optional')).not.toHaveAttribute('required', '');
  await expect(page.getByLabel('Email Optional')).not.toHaveAttribute('required', '');

  const orderedFields = [
    '#contact-enquiry-type-residential',
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

  await expect(page.getByRole('group', { name: 'Roof approach Optional' })).toBeVisible();
  await expect(page.locator('#contact-files')).toBeVisible();
  await expect(page.locator('#contact-files')).toHaveAttribute(
    'accept',
    '.pdf,.jpg,.jpeg,.png,.webp',
  );
  await expect(page.getByText(
    'PDF, JPG, JPEG, PNG or WebP. Add up to 8 files. Each file can be up to 20 MB, with 20 MB total.',
    { exact: true },
  )).toBeVisible();
});

test('API errors keep values and retries reuse the submission UUID', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
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

  await page.getByLabel('Name Required').fill('Test Person');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  await page.getByLabel('Email Optional').fill('test@example.com');
  await page.getByLabel('Project brief Optional').fill('Keep this project brief.');
  await page.getByRole('button', { name: 'Send us your project details' }).click();

  const alert = page.locator('.contact-form__submit-error');
  await expect(alert).toContainText('Enquiry service unavailable');
  await expect(alert).toBeFocused();
  await expect(page.getByLabel('Name Required')).toHaveValue('Test Person');
  await expect(page.getByLabel('Project brief Optional'))
    .toHaveValue('Keep this project brief.');

  await page.getByRole('button', { name: 'Send us your project details' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Thank you. We have your project brief.',
  );
  await expect(page.getByRole('status')).toBeFocused();
  await expect(page.getByLabel('Name Required')).toHaveValue('Test Person');
  await expect(page.getByLabel('Project brief Optional')).toHaveValue(
    'Keep this project brief.',
  );
  expect(payloads).toHaveLength(2);
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
  await page.getByLabel('Name Required').fill('Test Person');
  await page.getByLabel('Phone Required').fill('021 000 0000');

  const submit = page.getByRole('button', { name: 'Send us your project details' });
  await submit.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByRole('status')).toContainText('Project details received');
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
  await expect(page.getByRole('link', { name: 'Explore completed projects' }))
    .toHaveAttribute('href', '/projects');
  await expect(page.getByRole('link', { name: 'Review pergola options' }))
    .toHaveAttribute('href', '/products');
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
  await page.getByLabel('Name Required').fill('Test Homeowner');
  await page.getByLabel('Phone Required').fill('021 000 0000');

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
  await page.getByRole('button', { name: 'Send us your project details' }).click();
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
  await page.getByRole('button', { name: 'Send us your project details' }).click();
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
  await page.getByRole('button', { name: 'Send us your project details' }).click();
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
  await expect(page.getByRole('radio', { name: 'Residential', exact: false }))
    .toBeChecked();

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
  await page.getByRole('link', { name: 'Send your project details' }).first().click();
  await expect(page.getByLabel('Enquiry context')).toContainText(
    'Pergola option: Gable pergola',
  );
  expect(await page.getByRole('radio').evaluateAll((radios) =>
    radios.every((radio) => !(radio as HTMLInputElement).checked),
  )).toBe(true);
  await page.getByRole('radio', { name: 'Commercial', exact: false }).check();
  await page.getByLabel('Name Required').fill('Test Person');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  await page.getByRole('button', { name: 'Send us your project details' }).click();
  await expect(page.getByRole('status')).toContainText('Gable pergola option');

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

  await page.getByRole('button', { name: 'Send us your project details' }).click();
  const typeErrorId = await page.locator('fieldset.contact-form__type')
    .getAttribute('aria-describedby');
  expect(typeErrorId).toBe('contact-enquiryType-error');
  await expect(page.locator(`#${typeErrorId}`)).toContainText('Choose a project type.');
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
