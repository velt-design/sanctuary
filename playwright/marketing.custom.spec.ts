import { expect, test, type Page } from '@playwright/test';
import { customFaqs, customDescription } from '../apps/marketing/app/custom-pergolas-auckland/content';
import { CONFIGURATOR_PRICE_LEASE_HEADER, CONFIGURATOR_PRICE_PUBLICATION_HEADER } from '../apps/marketing/lib/configuratorPriceLease';

const path = '/custom-pergolas-auckland';
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

test('Custom guided evidence follows the selected priority without changing direct or finder visits', async ({ page }, info) => {
  const evidence = page.getByRole('navigation', { name: 'Projects for your starting point' });
  await page.goto(`${path}?constraint=structure`);
  await expect(page.getByText('Restricted posts, spans or levels', { exact: true })).toBeVisible();
  const links = evidence.getByRole('link');
  await expect(links).toHaveCount(3);
  expect(await links.evaluateAll(items => items.map(item => item.getAttribute('href')))).toEqual([
    '/projects/ardmore-box-carport', '/projects/tindalls-bay-pavilion', '/projects/warkworth-outdoor-room',
  ]);
  await expect(links.nth(0)).toContainText('Ardmore Box Carport');
  await expect(links.nth(0)).toContainText('A box-perimeter carport with acrylic roofing and an internal gable.');
  await expect(page.locator('#custom-projects article')).toHaveCount(2);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await evidence.scrollIntoViewIfNeeded();
    await expect(links.nth(0)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`custom-guided-evidence-${width}.png`) });
  }
  await links.first().click();
  await expect(page).toHaveURL(/\/projects\/ardmore-box-carport$/);
  await expect(page.locator('h1')).toHaveText('Ardmore Box Carport');
  await page.goBack();
  await expect(evidence).toBeVisible();
  await expect(page.locator('[data-guided-journey-context]').getByRole('link', { name: 'Change answers' }))
    .toHaveAttribute('href', '/home-guided?audience=home&goal=difficult-site&constraint=structure');
  expect(JSON.parse(await page.locator('input[name=enquiryContext]').inputValue())).toMatchObject({
    source_path: path, source_pathway: 'bespoke', source_focus: 'structure',
  });
  for (const suffix of ['', '?project=bespoke&priorities=daylight%2Ccoordination', '?constraint=invalid']) {
    await page.goto(`${path}${suffix}`);
    await expect(evidence).toHaveCount(0);
    await expect(page.locator('#custom-projects article')).toHaveCount(2);
    if (suffix.includes('project=')) await expect(page.locator('[data-project-finder-journey-context]')).toBeVisible();
  }
});

test('Custom research, photography, SEO and direct action remain usable from 320 to 2560', async ({ page }, info) => {
  await page.goto(path);
  await expect(page.locator('h1')).toHaveText('Custom pergolas.Designed around your home.');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${path}`);
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content', customDescription);
  await expect(page.locator('meta[name=robots]')).not.toHaveAttribute('content', /noindex/);
  await expect(page.locator('header.site')).toHaveCount(1);
  await expect(page.locator('[data-site-footer]')).toHaveCount(1);
  await expect(page.locator('#custom-projects article')).toHaveCount(2);
  await expect(page.locator('#custom-pergolas-faq details')).toHaveCount(customFaqs.length);
  await expect(page.locator('form[data-inline-enquiry]')).toHaveCount(1);
  expect((await events(page)).filter(event => event.name.startsWith('design_'))).toEqual([]);
  for (const width of [320, 390, 820, 1440, 2560]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1100 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    if (width < 800) {
      const firstLayer = await page.locator('main').evaluate(main => ({
        words: ((main as HTMLElement).innerText.trim().match(/\S+/g) ?? []).length,
        regions: new Set([...main.querySelectorAll<HTMLElement>('h1,h2')].filter(heading => heading.checkVisibility()).map(heading => heading.closest('section,form,article,aside'))).size,
      }));
      expect(firstLayer.words).toBeLessThanOrEqual(1000);
      expect(firstLayer.regions).toBeLessThanOrEqual(8);
    }
    const photo = page.locator('main figure').first();
    await expect.poll(() => photo.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect((await photo.boundingBox())!.width).toBeLessThanOrEqual(1313);
    await page.screenshot({ path: info.outputPath(`custom-opening-${width}.png`) });
    await page.getByRole('link', { name: 'Explore two real projects', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Different homes. Their own answers.' })).toBeInViewport();
    const bounds = await page.locator('#custom-projects article figure > a').evaluateAll(links => links.map(link => {
      const box = link.getBoundingClientRect(), img = link.querySelector('img')!.getBoundingClientRect();
      return { width: box.width, height: box.height, contained: img.top >= box.top - 1 && img.bottom <= box.bottom + 1 };
    }));
    bounds.forEach(box => { expect(box.width).toBeGreaterThan(200); expect(box.height).toBeGreaterThan(200); expect(box.contained).toBe(true); });
    for (const faq of customFaqs) {
      const summary = page.getByText(faq.question, { exact: true });
      await summary.click(); await expect(summary.locator('..')).toContainText(faq.answer); await summary.click();
    }
    await page.getByRole('link', { name: 'Talk about your space', exact: true }).click();
    await expect(page.locator('#enquiry-title')).toBeInViewport();
    await expect(page.locator('#enquiry-title')).toHaveText('What would you like to make room for?');
    await page.screenshot({ path: info.outputPath(`custom-enquiry-${width}.png`) });
  }
});

for (const width of [390, 1440]) test(`Custom enquiry preserves brief, full design, retry and reload at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ status: 503, json: { error: 'Synthetic retry fixture' } }); });
  await page.goto(`${path}?project=bespoke&priorities=daylight%2Ccoordination`);
  await expect(page.locator('[data-project-finder-journey-context]')).toBeVisible();
  const form = page.locator('form[data-inline-enquiry]');
  await page.getByRole('link', { name: 'Talk about your space', exact: true }).click();
  await form.locator('[name=name]').fill('Synthetic Custom Browser');
  await form.locator('[name=email]').fill('custom@example.invalid');
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
    source_path: path, source_experience: 'project-finder-home-v1', project_direction: 'bespoke', project_priorities: ['daylight', 'coordination'],
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
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Custom Browser');
  await expect(page.getByText('Your saved starting design will be included with this enquiry.', { exact: true })).toBeVisible();
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toMatchObject({ submissionId: payloads[0].submissionId, phone: '', page: path,
    customerDesign: { input: { widthMm: 5400 }, roof: { family: 'gable' } }, enquiryContext: payloads[0].enquiryContext });
  if (width >= 720) expect(payloads[1].customerDesign.roof.infills).toBe(true);
  else expect(payloads[1].customerDesign.roof.blinds.length).toBeGreaterThan(0);
  for (const name of ['design_start', 'design_review', 'design_enquiry_open']) expect((await events(page)).filter(event => event.name === name)).toHaveLength(1);
  await page.reload();
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Custom Browser');
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

test('Custom guided context and optional photo failure remain recoverable without any delivery', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/enquiry/attachments/sign', route => route.fulfill({ status: 503, json: { error: 'Synthetic signing failure' } }));
  await page.goto(`${path}?constraint=connection`);
  await expect(page.locator('[data-guided-journey-context]')).toBeVisible();
  const form = page.locator('form[data-inline-enquiry]');
  await form.locator('summary').filter({ hasText: 'Add photos or plans (optional)' }).click();
  const picker = form.locator('[name=files]');
  await picker.setInputFiles({ name: 'unsafe.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('synthetic') });
  await expect(form.locator('#contact-files-error')).toBeVisible();
  await picker.setInputFiles({ name: 'site.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  await expect(form.locator('#contact-files-error')).toHaveCount(0);
  await form.locator('[name=name]').fill('Synthetic Attachment');
  await form.locator('[name=email]').fill('custom@example.invalid');
  await form.locator('[name=suburb]').fill('Albany');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(form.getByRole('alert')).toContainText('We could not upload your attachments');
  expect(payloads).toHaveLength(0);
  await form.getByRole('button', { name: 'Remove site.png' }).click();
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Your enquiry has been sent.' })).toBeVisible();
  expect(payloads[0]).toMatchObject({ phone: '', files: [], enquiryContext: { source_path: path, source_pathway: 'bespoke', source_focus: 'connection' } });
  expect(payloads[0].customerDesign).toBeUndefined();
});

test('Custom native fallback preserves optional phone, source brief and discussion intent', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage(); let body = '';
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => { body = route.request().postData() ?? ''; return route.fulfill({ contentType: 'text/plain', body: 'Synthetic native receipt. No delivery.' }); });
  try {
    await page.goto(`${path}?constraint=connection`);
    const form = page.locator('form[data-inline-enquiry]');
    await form.locator('[name=name]').fill('Synthetic Native'); await form.locator('[name=email]').fill('custom@example.invalid'); await form.locator('[name=suburb]').fill('Albany');
    await expect(form.locator('[name=phone]')).not.toHaveAttribute('required');
    await expect(form.locator('[name=files]')).toBeDisabled();
    await form.getByRole('button', { name: 'Send my enquiry' }).click();
    await expect.poll(() => body).toContain('requestType=project-discussion');
    const payload = new URLSearchParams(body);
    expect(payload.get('page')).toBe(path); expect(payload.get('phone')).toBe(''); expect(payload.has('customerDesign')).toBe(false);
    expect(JSON.parse(payload.get('enquiryContext')!)).toMatchObject({ source_path: path, source_pathway: 'bespoke', source_focus: 'connection' });
  } finally { await context.close(); }
});
