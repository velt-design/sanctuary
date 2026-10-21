import { expect, test, type Page } from '@playwright/test';
import { blindsFaqs, blindsDescription } from '../apps/marketing/app/pergolas-with-blinds/content';
import { CONFIGURATOR_PRICE_LEASE_HEADER, CONFIGURATOR_PRICE_PUBLICATION_HEADER } from '../apps/marketing/lib/configuratorPriceLease';

const path = '/pergolas-with-blinds';
const guidedQuery = 'source_experience=guided-home-v1&source_pathway=outdoor-room&source_focus=poolside&source_path=%2Foutdoor-rooms-auckland';
const events = (page: Page) => page.evaluate(() => (window as unknown as { captured: { name: string; properties: Record<string, unknown> }[] }).captured);
test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => route.abort());
  await page.route('**/api/tracking-region', route => route.fulfill({ json: { policy: 'consent_required' } }));
  await page.route('**/api/configurator-price', route => route.fulfill({
    headers: { [CONFIGURATOR_PRICE_LEASE_HEADER]: '30000', [CONFIGURATOR_PRICE_PUBLICATION_HEADER]: 'b'.repeat(64) },
    json: { status: 'priced', amountIncGst: 16665, calculationRef: 'cf1.synthetic-browser-fixture', currency: 'NZD', includesGst: true,
      breakdown: [{ label: 'Synthetic fixture structure and selected options', amountIncGst: 16665 }] },
  }));
  await page.addInitScript(() => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: true, marketing: false, updatedAt: new Date().toISOString(), version: 1 }));
    const target = window as unknown as { captured: unknown[]; gtag: (...args: unknown[]) => void };
    target.captured = []; target.gtag = (kind, name, properties) => { if (kind === 'event') target.captured.push({ name, properties }); };
  });
});

test('Blinds preserves real starting context, project reference and recovery without inventing a recommendation', async ({ page }) => {
  await page.goto(`${path}?${guidedQuery}`);
  const guided = page.locator('[data-guided-journey-context]');
  await expect(guided).toHaveAttribute('data-guided-focus', 'poolside');
  await expect(guided.getByRole('link', { name: 'Change answers' })).toHaveAttribute('href', '/home-guided?audience=home&goal=outdoor-room&use=poolside');
  await page.goto(`${path}?project=outdoor-room&priorities=entertaining%2Cdaylight&reference=tindalls-bay-pavilion`);
  await expect(page.locator('[data-project-finder-journey-context]')).toContainText('preserve natural light');
  const form = page.locator('form[data-inline-enquiry]');
  expect(JSON.parse(await form.locator('[name=enquiryContext]').inputValue())).toMatchObject({ source_project: 'tindalls-bay-pavilion', source_path: '/projects/tindalls-bay-pavilion', project_priorities: ['daylight', 'entertaining'] });
  await expect(form.locator('[name=page]')).toHaveValue(path);
  await expect(form.locator('[name=phone]')).not.toHaveAttribute('required');
  const reference = page.getByRole('link', { name: 'Tindalls Bay - Patio & Carport', exact: true });
  const target = new URL((await reference.getAttribute('href'))!, 'http://localhost');
  expect(target.searchParams.get('reference')).toBe('tindalls-bay-pavilion');
  expect(target.searchParams.get('priorities')).toBe('daylight,entertaining');
  await reference.click(); await expect(page).toHaveURL(/projects\/tindalls-bay-pavilion\?/);
  await page.goBack(); await expect(form.locator('[name=page]')).toHaveValue(path);
  for (const suffix of ['', '?use=poolside', '?source_experience=guided-home-v1&source_pathway=outdoor-room&source_focus=invalid']) {
    await page.goto(`${path}${suffix}`);
    await expect(page.locator('[data-guided-journey-context],[data-project-finder-journey-context]')).toHaveCount(0);
  }
});

test('Blinds photography, research and enquiry stay readable from 320 to 2560 with ordinary site navigation', async ({ page, request }, info) => {
  await page.goto(path);
  await expect(page).toHaveTitle('Pergolas With Blinds Auckland | Integrated Outdoor Screens');
  await expect(page.locator('h1')).toHaveText('Pergolas with blinds.');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${path}`);
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content', blindsDescription);
  await expect(page.locator('meta[name=robots]')).not.toHaveAttribute('content', /noindex/);
  await expect(page.locator('header.site')).toHaveCount(1); await expect(page.locator('[data-site-footer]')).toHaveCount(1);
  await expect(page.locator('#blind-materials article')).toHaveCount(2);
  await expect(page.locator('#blinds-faq details')).toHaveCount(blindsFaqs.length);
  const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(text => JSON.parse(text));
  expect(schemas.map(item => item['@type'])).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList']));
  expect(schemas.map(item => item['@type'])).not.toContain('FAQPage');
  expect((await events(page)).filter(event => event.name.startsWith('design_'))).toEqual([]);
  expect(await (await request.get('/sitemap.xml')).text()).toContain(`https://www.sanctuarypergolas.co.nz${path}`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 820, 1440, 2560]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1100 }); await page.goto(path);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(page.locator('h1')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    const photo = page.locator('main figure').first();
    await expect.poll(() => photo.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect((await photo.boundingBox())!.width).toBeLessThanOrEqual(1313);
    if (width <= 390) expect((await photo.boundingBox())!.y).toBeLessThan(500);
    await page.screenshot({ path: info.outputPath(`blinds-opening-${width}.png`) });
    const state = page.locator('#blind-state-photo');
    const lowered = page.getByRole('button', { name: 'Lowered', exact: true });
    const raised = page.getByRole('button', { name: 'Raised', exact: true });
    await expect(lowered).toHaveAttribute('aria-pressed', 'true');
    await expect(state.getByAltText(/lowered to the sill/)).toBeVisible();
    const stateHeight = (await state.boundingBox())!.height;
    await raised.focus(); await raised.press('Enter');
    await expect(raised).toBeFocused(); await expect(raised).toHaveAttribute('aria-pressed', 'true');
    await expect(state.getByAltText(/rolled up/)).toBeVisible();
    await expect(state.getByAltText(/lowered to the sill/)).toBeHidden();
    expect(Math.abs((await state.boundingBox())!.height - stateHeight)).toBeLessThan(1);
    await state.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`blinds-raised-${width}.png`) });
    await lowered.focus(); await lowered.press('Space');
    await expect(lowered).toBeFocused(); await expect(lowered).toHaveAttribute('aria-pressed', 'true');
    await expect(state.getByAltText(/lowered to the sill/)).toBeVisible();
    await expect(page.getByText(/Two photographs of the same installation/)).toBeVisible();
    expect((await events(page)).filter(event => event.name.startsWith('design_'))).toEqual([]);
    await page.screenshot({ path: info.outputPath(`blinds-lowered-${width}.png`) });
    await page.getByRole('link', { name: 'Compare mesh and clear PVC', exact: true }).click();
    await expect(page.locator('#materials-title')).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`blinds-materials-${width}.png`) });
    for (const faq of blindsFaqs) {
      const summary = page.getByText(faq.question, { exact: true });
      await summary.focus(); await summary.press('Enter'); await expect(page.getByText(faq.answer, { exact: true })).toBeVisible(); await summary.press('Enter');
    }
    await page.getByRole('link', { name: 'Discuss your pergola', exact: true }).click();
    await expect(page.locator('#enquiry-title')).toBeInViewport();
    await expect(page.locator('#enquiry-title')).toHaveText('What would you like to change?');
    await page.screenshot({ path: info.outputPath(`blinds-enquiry-${width}.png`) });
  }
  await page.getByText('Are blinds manual or motorised?', { exact: true }).click();
  const copy = await page.locator('main').innerText(); expect(copy).not.toMatch(/[\u2013\u2014]/);
  expect(copy).toContain('flexible blind, not glass'); expect(copy).toContain('licensed electrician');
  expect(copy).not.toMatch(/\b(?:windproof guarantee|all.weather|best in auckland)\b/i);
});

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }]) test(`Blinds first visit keeps the whole hero above untouched consent controls at ${viewport.width}`, async ({ browser, baseURL }, info) => {
  // A genuinely fresh context: no seeded consent choice and no banner dismissal.
  const context = await browser.newContext({ baseURL, viewport });
  const page = await context.newPage();
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => route.abort());
  await page.route('**/api/tracking-region', route => route.fulfill({ json: { policy: 'consent_required' } }));
  try {
    await page.goto(path);
    const banner = page.getByRole('region', { name: 'Cookie preferences', exact: true });
    await expect(banner).toBeVisible();
    for (const name of ['Essential only', 'Accept all']) await expect(banner.getByRole('button', { name, exact: true })).toBeVisible();
    const hero = page.locator('main figure').first().locator('img');
    await expect.poll(() => hero.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const photoBox = (await hero.boundingBox())!;
    const bannerBox = (await banner.boundingBox())!;
    expect(photoBox.y + photoBox.height).toBeLessThanOrEqual(bannerBox.y);
    expect(photoBox.width / photoBox.height).toBeCloseTo(1.5, 1);
    const enquiry = page.getByRole('link', { name: 'Discuss your pergola', exact: true });
    await expect(enquiry).toHaveCount(1);
    expect((await enquiry.boundingBox())!.y + (await enquiry.boundingBox())!.height).toBeLessThan(photoBox.y);
    expect((await page.getByText('Open to the view. Screened where it matters. Plan outdoor blinds with your new pergola.', { exact: true }).boundingBox())!.y).toBeGreaterThan(photoBox.y + photoBox.height);
    await page.screenshot({ path: info.outputPath(`blinds-first-visit-${viewport.width}.png`) });
    await enquiry.click();
    await expect(page.locator('#enquiry-title')).toBeInViewport();
    await expect(banner).toBeVisible();
  } finally { await context.close(); }
});

for (const width of [390, 1440]) test(`Blinds enquiry preserves brief, full design, retry and reload at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ status: 503, json: { error: 'Synthetic retry fixture' } }); });
  await page.goto(`${path}?project=outdoor-room&priorities=entertaining%2Cdaylight`);
  await expect(page.locator('[data-project-finder-journey-context]')).toBeVisible();
  const form = page.locator('form[data-inline-enquiry]');
  await page.getByRole('link', { name: 'Discuss your pergola', exact: true }).click();
  await form.locator('[name=name]').fill('Synthetic Blinds Browser');
  await form.locator('[name=email]').fill('blinds@example.invalid');
  await form.locator('[name=suburb]').fill('Albany');
  await form.locator('[name=message]').fill('Keep the garden view and light in the house.');
  await form.locator('[name=phone]').fill('bad');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(form.getByText('Enter a valid phone number.', { exact: true })).toBeVisible();
  expect(payloads).toHaveLength(0);
  await form.locator('[name=phone]').fill('');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect.poll(() => payloads.length).toBe(1);
  expect(payloads[0].customerDesign).toBeUndefined();
  expect(payloads[0]).toMatchObject({ phone: '', enquiryIntent: 'bespoke', requestType: 'project-discussion', enquiryContext: {
    source_path: '/outdoor-rooms-auckland', source_experience: 'project-finder-home-v1', project_direction: 'outdoor-room', project_priorities: ['daylight', 'entertaining'],
  } });
  await page.getByRole('link', { name: 'Open the 3D designer', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Design your pergola' });
  await expect(dialog).toBeVisible();
  if (width < 720) await dialog.getByRole('button', { name: 'Set your size', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await dialog.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  if (width < 720) {
    await dialog.getByRole('button', { name: 'Add sides & lighting', exact: true }).click();
    await dialog.getByRole('button', { name: 'Next side configuration', exact: true }).click();
    await expect(dialog.locator('canvas')).toBeVisible();
    await dialog.getByRole('button', { name: 'Review your design', exact: true }).click();
    await dialog.getByRole('button', { name: 'Enquire', exact: true }).click();
  } else {
    await expect(dialog.locator('canvas')).toBeVisible();
    await dialog.getByRole('checkbox', { name: 'Gable infills', exact: true }).check();
    await dialog.getByRole('button', { name: '3 Review', exact: true }).click();
    await dialog.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  }
  await expect(dialog).not.toBeVisible();
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Blinds Browser');
  await expect(page.getByText('Your saved starting design will be included.', { exact: true })).toBeVisible();
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toMatchObject({ submissionId: payloads[0].submissionId, phone: '', page: path,
    customerDesign: { input: { widthMm: 5400 }, roof: { family: 'gable' } }, enquiryContext: payloads[0].enquiryContext });
  if (width >= 720) expect(payloads[1].customerDesign.roof.infills).toBe(true);
  else expect(payloads[1].customerDesign.roof.blinds.length).toBeGreaterThan(0);
  for (const name of ['design_start', 'design_review', 'design_enquiry_open']) expect((await events(page)).filter(event => event.name === name)).toHaveLength(1);
  await page.reload();
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Blinds Browser');
  await page.getByRole('link', { name: 'Edit your starting design', exact: true }).click();
  await expect(dialog).toBeVisible();
  if (width >= 720) {
    await dialog.getByRole('button', { name: 'Edit Size & structure', exact: true }).click();
    await expect(dialog.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('5.4');
  }
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect.poll(() => payloads.length).toBe(3);
  expect(payloads[2].customerDesign).toEqual(payloads[1].customerDesign);
});

test('Blinds guided context and optional photo failure remain recoverable without any delivery', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/enquiry/attachments/sign', route => route.fulfill({ status: 503, json: { error: 'Synthetic signing failure' } }));
  await page.goto(`${path}?${guidedQuery}`);
  await expect(page.locator('[data-guided-journey-context]')).toBeVisible();
  const form = page.locator('form[data-inline-enquiry]');
  await form.locator('summary').filter({ hasText: 'Add photos or plans (optional)' }).click();
  const picker = form.locator('[name=files]');
  await picker.setInputFiles({ name: 'unsafe.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('synthetic') });
  await expect(form.locator('#contact-files-error')).toBeVisible();
  await picker.setInputFiles({ name: 'site.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  await expect(form.locator('#contact-files-error')).toHaveCount(0);
  await form.locator('[name=name]').fill('Synthetic Attachment');
  await form.locator('[name=email]').fill('blinds@example.invalid');
  await form.locator('[name=suburb]').fill('Albany');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(form.getByRole('alert')).toContainText('We could not upload your attachments');
  expect(payloads).toHaveLength(0);
  await form.getByRole('button', { name: 'Remove site.png' }).click();
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Your enquiry has been sent.' })).toBeVisible();
  expect(payloads[0]).toMatchObject({ phone: '', files: [], enquiryContext: { source_path: '/outdoor-rooms-auckland', source_pathway: 'outdoor-room', source_focus: 'poolside' } });
  expect(payloads[0].customerDesign).toBeUndefined();
});

test('Blinds native fallback preserves optional phone, source brief and discussion intent', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage(); let body = '';
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => { body = route.request().postData() ?? ''; return route.fulfill({ contentType: 'text/plain', body: 'Synthetic native receipt. No delivery.' }); });
  try {
    await page.goto(`${path}?${guidedQuery}`);
    const form = page.locator('form[data-inline-enquiry]');
    await form.locator('[name=name]').fill('Synthetic Native'); await form.locator('[name=email]').fill('blinds@example.invalid'); await form.locator('[name=suburb]').fill('Albany');
    await expect(form.locator('[name=phone]')).not.toHaveAttribute('required');
    await expect(form.locator('[name=files]')).toBeDisabled();
    await form.getByRole('button', { name: 'Send my enquiry' }).click();
    await expect.poll(() => body).toContain('requestType=project-discussion');
    const payload = new URLSearchParams(body);
    expect(payload.get('page')).toBe(path); expect(payload.get('phone')).toBe(''); expect(payload.has('customerDesign')).toBe(false);
    expect(JSON.parse(payload.get('enquiryContext')!)).toMatchObject({ source_path: '/outdoor-rooms-auckland', source_pathway: 'outdoor-room', source_focus: 'poolside' });
  } finally { await context.close(); }
});
