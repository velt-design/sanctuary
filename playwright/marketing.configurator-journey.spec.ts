import { expect, test } from '@playwright/test';

for (const marketing of [true, false]) test(`campaign source survives designer to submitted enquiry only with marketing ${marketing}`, async ({ page }) => {
  await page.addInitScript(enabled => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: enabled, updatedAt: new Date().toISOString(), version: 1 }));
  }, marketing);
  await page.route('**/*', async handler => {
    const url = new URL(handler.request().url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return handler.abort();
    return handler.fallback();
  });
  await page.route('**/api/configurator-price', handler => handler.fulfill({ json: { status: 'disabled' } }));
  await page.goto('/simple-pergolas-auckland?utm_source=meta&utm_medium=paid_social&utm_campaign=synthetic-journey&utm_content=synthetic-draft&secret=discard#private');
  await page.getByRole('link', { name: 'Design your pergola', exact: true }).first().click();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  await page.getByRole('button', { name: '3 Review', exact: true }).click();
  await page.getByRole('link', { name: 'Enquire about this design' }).click();
  await expect(page).toHaveURL(/\/design-enquiry/);
  expect(page.url()).not.toContain('utm_');
  await page.locator('#contact-name').fill('Synthetic campaign test');
  await page.locator('#contact-email').fill('campaign@example.test');
  await page.locator('#contact-suburb').fill('Auckland');
  const request = page.waitForRequest(req => req.url().endsWith('/api/enquiry') && req.method() === 'POST');
  await page.getByRole('button', { name: 'Send my enquiry' }).click();
  const body = (await request).postDataJSON();
  expect(body.attribution.utm).toEqual(marketing ? { utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'synthetic-journey', utm_content: 'synthetic-draft' } : {});
  expect(body.requestType).toBe('project-discussion');
  expect(body.customerDesign.input.widthMm).toBe(5400);
  expect(body.attribution.consent.marketing).toBe(marketing);
  expect(JSON.stringify(body.attribution)).not.toMatch(/secret|discard|private/);
  if (marketing) expect(body.attribution.landingPage).toMatch(/\/simple-pergolas-auckland$/);
  await expect(page.getByRole('heading', { name: 'Your enquiry has been sent.' })).toBeVisible();
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: '2026-09-09T00:00:00.000Z', version: 1 }));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (url: string) => { (window as unknown as { copiedDesign: string }).copiedDesign = url; } } });
  });
  await page.route('**/api/simple-cover-price', async request => {
    const input = request.request().postDataJSON();
    await request.fulfill({ json: { ok: true, status: 'priced', input, areaM2: input.widthMm * input.projectionMm / 1e6,
      price: { fromIncGst: 11500, currency: 'NZD' }, calculationRef: `sc1.fresh-${input.widthMm}-${input.projectionMm}`,
      configuration: { versionNumber: 23 }, plan: { postPositions: [0, .5, 1], rafterPositions: [0, 1] }, postCount: 3, postSpacingMm: 3000 } });
  });
  await page.route('**/api/enquiry', request => request.fulfill({ json: { ok: true } }));
});

for (const width of [360, 390, 1440]) test(`reachable action, roof guidance and compact enquiry at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/configurator-preview?open=1');
  const next = page.getByRole('link', { name: 'Continue with this design' });
  await expect(next).toBeInViewport();
  const before = (await next.boundingBox())!;
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Gable', exact: true })).toHaveAccessibleDescription(/raised ridge/);
  await expect(page.getByText('Two slopes meet at a raised ridge.')).toBeVisible();
  await page.getByRole('radio', { name: 'Elevated', exact: true }).check();
  expect((await next.boundingBox())!.y).toBeCloseTo(before.y, 0);
  await expect(next).toBeInViewport();
  await next.click();
  await page.getByRole('link', { name: 'Project details ↓', exact: true }).click();
  await expect(page.getByLabel('Project suburb Optional')).toBeInViewport();
  const details = page.getByLabel('Design included with your enquiry').locator('details');
  await expect(details).not.toHaveAttribute('open');
  await details.locator('summary').click();
  await expect(details).toContainText('Elevated');
  await page.getByRole('link', { name: 'Edit your design ↑', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Gable', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
});

test('copy link opens the exact design in an independent browser and edits survive refresh', async ({ page, browser }) => {
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await page.getByRole('radio', { name: 'Away from house', exact: true }).check();
  await page.getByLabel('Gable infills', { exact: true }).check();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('7.2');
  await page.getByRole('button', { name: 'Copy design link', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  const url = await page.evaluate(() => (window as unknown as { copiedDesign: string }).copiedDesign);
  expect(url).toContain('#design=1.gable.7200.3000.ground.facade.away.1');
  const recipient = await browser.newContext();
  try {
    const opened = await recipient.newPage();
    await opened.goto(url);
    await expect(opened.getByRole('radio', { name: 'Gable', exact: true })).toBeChecked();
    await expect(opened.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('7.2');
    await expect(opened.getByLabel('Gable infills', { exact: true })).toBeChecked();
    expect(opened.url()).not.toContain('#design=');
    await opened.getByRole('textbox', { name: 'Width in metres' }).fill('6.4');
    await opened.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
    await opened.reload();
    await expect(opened.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('6.4');
  } finally { await recipient.close(); }
});

test('shared pitched link wins over an existing draft and requests only its fresh estimate', async ({ page }) => {
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('radio', { name: 'Box perimeter', exact: true }).check();
  const prices: unknown[] = [];
  page.on('request', req => { if (req.url().endsWith('/api/simple-cover-price')) prices.push(req.postDataJSON()); });
  await page.goto('/configurator-preview?open=1#design=1.mono.6400.3200.ground.facade.parallel.0');
  await expect(page.getByRole('region', { name: 'Estimated price' })).toContainText('$11,500');
  expect(prices).toEqual([{ widthMm: 6400, projectionMm: 3200, level: 'ground', connection: 'facade' }]);
  await page.getByRole('link', { name: 'Continue with this design' }).click();
  await expect(page.getByLabel('Design included with your enquiry')).toContainText('6.4 m wide');
});

test('invalid links preserve the current draft and clipboard denial offers a selectable link', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } }));
  await page.goto('/configurator-preview?open=1#design=2.bad-data');
  await expect(page.getByText('This design link could not be opened.', { exact: false })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('6.0');
  await page.getByRole('button', { name: 'Copy design link', exact: true }).click();
  await expect(page.getByLabel('Design link', { exact: true })).toHaveValue(/#design=1.mono.6000/);
});

test('native sharing receives the current design and cancellation remains quiet', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
    (window as unknown as { sharedDesign: ShareData }).sharedDesign = data;
    throw new DOMException('Cancelled', 'AbortError');
  } }));
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('button', { name: 'Share…', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { sharedDesign: ShareData }).sharedDesign.url)).toContain('#design=1.mono.6000.3000');
  await expect(page.getByLabel('Design link', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Share menu opened.', { exact: true })).toHaveCount(0);
});

for (const analytics of [false, true]) test(`configured funnel reconciles events and errors with analytics ${analytics}`, async ({ page }) => {
  await page.addInitScript((enabled) => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: enabled, marketing: false, updatedAt: '2026-09-16T00:00:00.000Z', version: 1 }));
    (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag = (...args) => {
      const events = JSON.parse(sessionStorage.getItem('funnel-test-events') ?? '[]');
      events.push(args); sessionStorage.setItem('funnel-test-events', JSON.stringify(events));
    };
  }, analytics);
  await page.route(/https:\/\/([^/]+\.)?(googletagmanager|google-analytics|doubleclick)\.(com|net)\//, request => request.abort());
  await page.route('**/api/configurator-price', request => request.fulfill({ json: { status: 'disabled' } }));
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  await page.getByRole('navigation', { name: 'Design stages' }).getByRole('button', { name: '3 Review' }).click();
  await page.getByRole('link', { name: 'Enquire about this design' }).click();
  await page.locator('#contact-name').fill('Synthetic funnel test');
  await page.locator('#contact-email').fill('funnel@example.test');
  await page.locator('#contact-suburb').fill('Auckland');
  let attempts = 0;
  let acceptedId: unknown;
  await page.route('**/api/enquiry', async handler => {
    attempts += 1;
    const payload = handler.request().postDataJSON();
    if (attempts === 1) return handler.fulfill({ status: 503, json: { ok: false, error: 'temporarily_unavailable' } });
    acceptedId = payload.submissionId;
    await handler.fulfill({ json: { ok: true } });
  });
  const events = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('funnel-test-events') ?? '[]') as unknown[][]);
  await page.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(page.locator('form').getByRole('alert')).toBeVisible();
  expect((await events()).filter(entry => entry[1] === 'contact_success')).toHaveLength(0);
  await page.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Your enquiry has been sent.' })).toBeVisible();
  expect(attempts).toBe(2);
  const emitted = (await events()).filter(entry => entry[0] === 'event');
  if (!analytics) expect(emitted).toEqual([]);
  else {
    for (const name of ['design_start', 'design_edit', 'design_review', 'contact_error', 'contact_success']) {
      expect(emitted.filter(entry => entry[1] === name), name).toHaveLength(1);
    }
    expect(emitted.find(entry => entry[1] === 'contact_success')?.[2]).toMatchObject({ configured_design: true, lead_event_id: acceptedId });
    expect(JSON.stringify(emitted)).not.toMatch(/Synthetic funnel test|funnel@example|5400|Auckland/);
  }
});

test('configured funnel waits for regional consent on a public overlay entry', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('sp_consent_v1');
    sessionStorage.removeItem('sp_tracking_region_v1');
    (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag = (...args) => {
      const events = JSON.parse(sessionStorage.getItem('funnel-test-events') ?? '[]');
      events.push(args); sessionStorage.setItem('funnel-test-events', JSON.stringify(events));
    };
  });
  let releaseRegion!: () => void;
  const regionReady = new Promise<void>(resolve => { releaseRegion = resolve; });
  await page.route('**/api/tracking-region', async handler => {
    await regionReady;
    await handler.fulfill({ json: { policy: 'nz_automatic' } });
  });
  await page.route(/https:\/\/([^/]+\.)?(googletagmanager|google-analytics|doubleclick)\.(com|net)\//, request => request.abort());
  await page.goto('/simple-pergolas-auckland?utm_source=meta&utm_campaign=synthetic-delayed');
  await page.getByRole('link', { name: 'Design your pergola', exact: true }).first().click();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toBeVisible();
  const events = () => page.evaluate(() => (JSON.parse(sessionStorage.getItem('funnel-test-events') ?? '[]') as unknown[][]).filter(event => event[0] === 'event'));
  expect(await events()).toEqual([]);
  expect(await page.evaluate(() => sessionStorage.getItem('sanctuary.campaign-context.v1'))).toBeNull();
  releaseRegion();
  await expect.poll(async () => (await events()).filter(event => event[1] === 'design_start').length).toBe(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.campaign-context.v1') ?? '{}').context?.utm)).toEqual({ utm_source: 'meta', utm_campaign: 'synthetic-delayed' });
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  await page.getByRole('button', { name: '3 Review', exact: true }).click();
  expect((await events()).map(event => event[1])).toEqual(['design_start', 'design_edit', 'design_review']);
  expect((await events())[0][2]).toMatchObject({ source_path: '/simple-pergolas-auckland' });
});
