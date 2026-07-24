import { expect, test, type Locator, type Page } from '@playwright/test';

const route = '/contact';
const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
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
    const response = await page.goto(`${route}?enquiry=residential`, {
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

test('query preselection is server rendered and invalid values leave the chooser open', async ({
  page,
  request,
}) => {
  await preparePage(page);

  for (const [value, name] of [
    ['residential', 'Residential'],
    ['commercial', 'Commercial'],
    ['professional', 'Architect, designer or builder'],
  ] as const) {
    const response = await request.get(`${route}?enquiry=${value}`);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toMatch(
      new RegExp(`<input[^>]*name="enquiryType"[^>]*checked=""[^>]*value="${value}"`),
    );

    await page.goto(`${route}?enquiry=${value}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('radio', { name, exact: false })).toBeChecked();
  }

  await page.goto(`${route}?enquiry=general`, { waitUntil: 'networkidle' });
  expect(await page.getByRole('radio').evaluateAll((radios) =>
    radios.every((radio) => !(radio as HTMLInputElement).checked),
  )).toBe(true);
});

test('validated project and product context is visible, refresh-safe and submitted', async ({
  page,
}) => {
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

  const projectUrl = `${route}?enquiry=residential`
    + '&source_path=%2Fprojects%2Fwarkworth-outdoor-room'
    + '&source_component=project-final'
    + '&project=warkworth-outdoor-room#contact-form';
  await page.goto(projectUrl, { waitUntil: 'networkidle' });

  const context = page.getByRole('complementary', { name: 'Enquiry context' });
  await expect(context).toContainText('Residential');
  await expect(context).toContainText('Warkworth Outdoor Room');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(context).toContainText('Warkworth Outdoor Room');

  await page.getByLabel('Name Required').fill('Test Person');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  await page.getByRole('button', { name: 'Send us your project details' }).click();
  await expect(page.getByRole('status')).toContainText('Project details received');
  expect(submittedBody).toMatchObject({
    enquiryType: 'residential',
    sourceContext: {
      sourcePath: '/projects/warkworth-outdoor-room',
      sourceComponent: 'project-final',
      projectSlug: 'warkworth-outdoor-room',
    },
  });

  await page.goto(
    `${route}?enquiry=residential`
    + '&source_path=%2Fproducts%2Fpergolas%2Fgable'
    + '&source_component=product-hero&product=gable',
    { waitUntil: 'networkidle' },
  );
  await expect(page.getByRole('complementary', { name: 'Enquiry context' }))
    .toContainText('Gable pergola');

  await page.goto(
    `${route}?enquiry=unknown&source_path=https%3A%2F%2Fexample.com`
    + '&source_component=anything&project=..%2Fcustomer',
    { waitUntil: 'networkidle' },
  );
  await expect(page.getByRole('complementary', { name: 'Enquiry context' }))
    .toHaveCount(0);
  expect(await page.getByRole('radio').evaluateAll((radios) =>
    radios.every((radio) => !(radio as HTMLInputElement).checked),
  )).toBe(true);
});

test('validation is specific, focuses the first issue and preserves entered details', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route, { waitUntil: 'networkidle' });

  const message = page.getByLabel('Project brief Optional');
  await message.fill('A sheltered dining area that keeps daylight in the kitchen.');
  await page.getByRole('button', { name: 'Send us your project details' }).click();
  await expect(page.getByText('Choose a project type.')).toBeVisible();
  await expect(page.getByRole('radio').first()).toBeFocused();
  await expect(message).toHaveValue(
    'A sheltered dining area that keeps daylight in the kitchen.',
  );

  await page.getByRole('radio', { name: 'Residential', exact: false }).check();
  await page.getByRole('button', { name: 'Send us your project details' }).click();
  await expect(page.getByText('Enter your name.')).toBeVisible();
  await expect(page.getByLabel('Name Required')).toBeFocused();

  await page.getByLabel('Name Required').fill('Test Person');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  await page.getByLabel('Email Optional').fill('not-an-email');
  await page.getByRole('button', { name: 'Send us your project details' }).click();
  await expect(
    page.getByText('Enter a valid email address or leave this field blank.'),
  ).toBeVisible();
  await expect(page.getByLabel('Email Optional')).toBeFocused();
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
  await page.goto(`${route}?enquiry=residential&utm_source=test&gclid=click-123`, {
    waitUntil: 'networkidle',
  });

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
  await page.route('**/api/enquiry', async (handler) => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 200));
    await handler.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto(
    `${route}?enquiry=residential&source_path=%2F&source_component=homepage-final`,
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
  const leadEvents = events.dataLayer?.filter(
    (event) => event.event === 'lead_submitted',
  );
  expect(leadEvents).toHaveLength(1);
  expect(leadEvents?.[0]).toMatchObject({
    enquiry_type: 'Residential',
    source_path: '/',
    source_component: 'homepage-final',
  });
  expect(events.tracked?.some((entry) => entry.includes('contact_start'))).toBe(true);
  expect(events.tracked?.some((entry) => entry.includes('contact_success'))).toBe(true);
  expect(JSON.stringify(events)).not.toContain('Test Person');
  await expect(page.getByRole('link', { name: 'Explore completed projects' }))
    .toHaveAttribute('href', '/projects');
  await expect(page.getByRole('link', { name: 'Review pergola options' }))
    .toHaveAttribute('href', '/products');
});

test('attachments are available to residential and professional enquiries with exact policy errors', async ({
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
  await page.goto(`${route}?enquiry=residential`, { waitUntil: 'networkidle' });
  await page.getByLabel('Name Required').fill('Test Customer');
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
  await expect(page.getByText(
    'Each file must be larger than 0 bytes and no larger than 20 MB.',
  )).toBeVisible();
  await page.getByRole('button', { name: 'Send us your project details' }).click();
  expect(requestCount).toBe(0);
  await expect(files).toBeFocused();

  await files.setInputFiles({
    name: 'payload.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('invalid'),
  });
  await expect(page.getByText(
    'Attachments must be PDF, JPG, PNG, or WebP files with matching file extensions.',
  )).toBeVisible();
  await page.getByRole('button', { name: 'Send us your project details' }).click();
  expect(requestCount).toBe(0);
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
  await expect(page.getByRole('status')).toContainText('Project details received');
  expect(requestCount).toBe(1);
  expect(submittedBody).toMatchObject({
    enquiryType: 'residential',
    company: null,
    uploadSessionToken: null,
    files: [{ name: 'plan.pdf', size: 9, type: 'application/pdf' }],
  });

  await page.goto(`${route}?enquiry=professional`, { waitUntil: 'networkidle' });
  await expect(page.getByLabel('Photos, plans or sketches Optional')).toBeVisible();
});
