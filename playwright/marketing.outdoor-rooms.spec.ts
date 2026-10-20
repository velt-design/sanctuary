import { expect, test, type Page } from '@playwright/test';
import { outdoorRoomFaqs, outdoorRoomsDescription } from '../apps/marketing/app/outdoor-rooms-auckland/content';
import { CONFIGURATOR_PRICE_LEASE_HEADER, CONFIGURATOR_PRICE_PUBLICATION_HEADER } from '../apps/marketing/lib/configuratorPriceLease';

const path = '/outdoor-rooms-auckland';
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

test('Outdoor Rooms guided and finder journeys retain meaningful project evidence and return paths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [use, expected] of [
    ['everyday', ['warkworth-outdoor-room', 'tindalls-bay-pavilion', 'riverhead-gable-pavilion']],
    ['entertaining', ['warkworth-outdoor-room', 'tindalls-bay-pavilion', 'riverhead-gable-pavilion']],
    ['poolside', ['riverhead-gable-pavilion', 'warkworth-outdoor-room', 'tindalls-bay-pavilion']],
  ] as const) {
    await page.goto(`${path}?use=${use}`);
    const context = page.locator('[data-guided-journey-context]');
    await expect(context).toHaveAttribute('data-guided-focus', use);
    await expect(context.getByRole('link', { name: 'Change answers' })).toHaveAttribute('href', `/home-guided?audience=home&goal=outdoor-room&use=${use}`);
    expect(await page.locator('[data-room-project]').evaluateAll(items => items.map(item => item.getAttribute('data-room-project')))).toEqual(expected);
    const first = page.locator('[data-room-project]').first();
    await expect(first.locator('img')).toHaveAttribute('alt', /\S/);
    await expect(first.locator('h3')).toBeVisible();
    expect(JSON.parse(await page.locator('[name=enquiryContext]').inputValue())).toMatchObject({ source_path: path, source_pathway: 'outdoor-room', source_focus: use });
  }
  await page.goto(`${path}?project=outdoor-room&priorities=entertaining%2Cdaylight`);
  const finder = page.locator('[data-project-finder-journey-context]');
  await expect(finder).toBeVisible();
  await expect(finder.getByRole('link', { name: 'Refine your brief' })).toHaveAttribute('href', /project=outdoor-room.*priorities=/);
  const project = page.locator('[data-room-project]').first().getByRole('link', { name: 'Explore the project', exact: true });
  const projectUrl = new URL((await project.getAttribute('href'))!, 'http://localhost');
  expect(projectUrl.searchParams.get('project')).toBe('outdoor-room');
  expect(projectUrl.searchParams.get('priorities')?.split(',').sort()).toEqual(['daylight', 'entertaining']);
  expect(projectUrl.searchParams.get('reference')).toBe('warkworth-outdoor-room');
  await project.click();
  await expect(page).toHaveURL(/projects\/warkworth-outdoor-room\?/);
  const discuss = page.getByRole('link', { name: /Discuss a similar project/ }).first();
  const enquiryUrl = new URL((await discuss.getAttribute('href'))!, 'http://localhost');
  expect(enquiryUrl.searchParams.get('source_project')).toBe('warkworth-outdoor-room');
  expect(enquiryUrl.searchParams.get('project_direction')).toBe('outdoor-room');
  expect(enquiryUrl.searchParams.get('project_priorities')?.split(',').sort()).toEqual(['daylight', 'entertaining']);
  expect(enquiryUrl.searchParams.get('source_experience')).toBe('project-finder-home-v1');
  await page.goBack();
  await expect(finder).toBeVisible();
  for (const suffix of ['', '?use=invalid']) {
    await page.goto(`${path}${suffix}`);
    await expect(page.locator('[data-guided-journey-context]')).toHaveCount(0);
    expect(await page.locator('[data-room-project]').evaluateAll(items => items.map(item => item.getAttribute('data-room-project')))).toEqual(['warkworth-outdoor-room', 'riverhead-gable-pavilion', 'tindalls-bay-pavilion']);
  }
});

test('Outdoor Rooms research, photography, SEO and direct action remain usable from 320 to 2560', async ({ page }, info) => {
  await page.goto(path);
  await expect(page.locator('h1')).toHaveText('Outdoor rooms.More life outside.');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${path}`);
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content', outdoorRoomsDescription);
  await expect(page.locator('meta[name=robots]')).not.toHaveAttribute('content', /noindex/);
  await expect(page.locator('header.site')).toHaveCount(1);
  await expect(page.locator('[data-site-footer]')).toHaveCount(1);
  await expect(page.locator('#outdoor-room-projects article')).toHaveCount(3);
  await expect(page.locator('#outdoor-rooms-faq details')).toHaveCount(outdoorRoomFaqs.length);
  await expect(page.locator('form[data-inline-enquiry]')).toHaveCount(1);
  const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(text => JSON.parse(text));
  expect(schemas.map(item => item['@type'])).toEqual(expect.arrayContaining(['WebPage', 'Service', 'BreadcrumbList']));
  expect(schemas.map(item => item['@type'])).not.toContain('FAQPage');
  expect((await events(page)).filter(event => event.name.startsWith('design_'))).toEqual([]);
  for (const width of [320, 390, 820, 1440, 2560]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1100 });
    await page.goto(path);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('h1')).toBeInViewport();
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
    await page.screenshot({ path: info.outputPath(`outdoor-opening-${width}.png`) });
    await page.getByRole('link', { name: 'See how real rooms work', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'A different way to use the outdoors.' })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`outdoor-projects-${width}.png`) });
    const bounds = await page.locator('#outdoor-room-projects article figure > a').evaluateAll(links => links.map(link => {
      const box = link.getBoundingClientRect(), img = link.querySelector('img')!.getBoundingClientRect();
      return { width: box.width, height: box.height, contained: img.top >= box.top - 1 && img.bottom <= box.bottom + 1 };
    }));
    bounds.forEach(box => { expect(box.width).toBeGreaterThan(200); expect(box.height).toBeGreaterThan(200); expect(box.contained).toBe(true); });
    for (const faq of outdoorRoomFaqs) {
      const summary = page.getByText(faq.question, { exact: true });
      await summary.focus(); await summary.press('Enter'); await expect(summary.locator('..')).toContainText(faq.answer); await summary.press('Enter');
    }
    await page.getByRole('link', { name: 'Plan your outdoor room', exact: true }).click();
    await expect(page.locator('#enquiry-title')).toBeInViewport();
    await expect(page.locator('#enquiry-title')).toHaveText('What would your room make possible?');
    await page.screenshot({ path: info.outputPath(`outdoor-enquiry-${width}.png`) });
  }
});

for (const width of [390, 1440]) test(`Outdoor Rooms enquiry preserves brief, full design, retry and reload at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ status: 503, json: { error: 'Synthetic retry fixture' } }); });
  await page.goto(`${path}?project=outdoor-room&priorities=entertaining%2Cdaylight`);
  await expect(page.locator('[data-project-finder-journey-context]')).toBeVisible();
  const form = page.locator('form[data-inline-enquiry]');
  await page.getByRole('link', { name: 'Plan your outdoor room', exact: true }).click();
  await form.locator('[name=name]').fill('Synthetic Outdoor Rooms Browser');
  await form.locator('[name=email]').fill('outdoor@example.invalid');
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
    source_path: path, source_experience: 'project-finder-home-v1', project_direction: 'outdoor-room', project_priorities: ['daylight', 'entertaining'],
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
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Outdoor Rooms Browser');
  await expect(page.getByText('Your saved starting design will be included with this enquiry.', { exact: true })).toBeVisible();
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toMatchObject({ submissionId: payloads[0].submissionId, phone: '', page: path,
    customerDesign: { input: { widthMm: 5400 }, roof: { family: 'gable' } }, enquiryContext: payloads[0].enquiryContext });
  if (width >= 720) expect(payloads[1].customerDesign.roof.infills).toBe(true);
  else expect(payloads[1].customerDesign.roof.blinds.length).toBeGreaterThan(0);
  for (const name of ['design_start', 'design_review', 'design_enquiry_open']) expect((await events(page)).filter(event => event.name === name)).toHaveLength(1);
  await page.reload();
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Outdoor Rooms Browser');
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

test('Outdoor Rooms guided context and optional photo failure remain recoverable without any delivery', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/enquiry/attachments/sign', route => route.fulfill({ status: 503, json: { error: 'Synthetic signing failure' } }));
  await page.goto(`${path}?use=poolside`);
  await expect(page.locator('[data-guided-journey-context]')).toBeVisible();
  const form = page.locator('form[data-inline-enquiry]');
  await form.locator('summary').filter({ hasText: 'Add photos or plans (optional)' }).click();
  const picker = form.locator('[name=files]');
  await picker.setInputFiles({ name: 'unsafe.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('synthetic') });
  await expect(form.locator('#contact-files-error')).toBeVisible();
  await picker.setInputFiles({ name: 'site.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  await expect(form.locator('#contact-files-error')).toHaveCount(0);
  await form.locator('[name=name]').fill('Synthetic Attachment');
  await form.locator('[name=email]').fill('outdoor@example.invalid');
  await form.locator('[name=suburb]').fill('Albany');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(form.getByRole('alert')).toContainText('We could not upload your attachments');
  expect(payloads).toHaveLength(0);
  await form.getByRole('button', { name: 'Remove site.png' }).click();
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Your enquiry has been sent.' })).toBeVisible();
  expect(payloads[0]).toMatchObject({ phone: '', files: [], enquiryContext: { source_path: path, source_pathway: 'outdoor-room', source_focus: 'poolside' } });
  expect(payloads[0].customerDesign).toBeUndefined();
});

test('Outdoor Rooms native fallback preserves optional phone, source brief and discussion intent', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage(); let body = '';
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => { body = route.request().postData() ?? ''; return route.fulfill({ contentType: 'text/plain', body: 'Synthetic native receipt. No delivery.' }); });
  try {
    await page.goto(`${path}?use=poolside`);
    const form = page.locator('form[data-inline-enquiry]');
    await form.locator('[name=name]').fill('Synthetic Native'); await form.locator('[name=email]').fill('outdoor@example.invalid'); await form.locator('[name=suburb]').fill('Albany');
    await expect(form.locator('[name=phone]')).not.toHaveAttribute('required');
    await expect(form.locator('[name=files]')).toBeDisabled();
    await form.getByRole('button', { name: 'Send my enquiry' }).click();
    await expect.poll(() => body).toContain('requestType=project-discussion');
    const payload = new URLSearchParams(body);
    expect(payload.get('page')).toBe(path); expect(payload.get('phone')).toBe(''); expect(payload.has('customerDesign')).toBe(false);
    expect(JSON.parse(payload.get('enquiryContext')!)).toMatchObject({ source_path: path, source_pathway: 'outdoor-room', source_focus: 'poolside' });
  } finally { await context.close(); }
});
