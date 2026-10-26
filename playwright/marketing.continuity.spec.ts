import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { LANDING_PRICE_CELLS } from '../apps/marketing/lib/landingPriceTable';

// Populated tests never reach lead intake, signed upload or external measurement.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/enquiry**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Synthetic preview retry. No enquiry was sent.' }) }));
  await page.route('**/api/contact', route => route.abort());
  await page.route(/https:\/\/(?!127\.0\.0\.1|localhost).*\/(?:storage\/v1|g\/collect|tr|collect)/, route => route.abort());
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function scrollPage(page: Page, top: number) {
  await page.evaluate(y => {
    const body = document.body;
    const ownsScroll = /^(auto|scroll|overlay)$/.test(getComputedStyle(body).overflowY) && body.scrollHeight > body.clientHeight + 1;
    if (ownsScroll) body.scrollTo({ top: y, behavior: 'instant' });
    else window.scrollTo({ top: y, behavior: 'instant' });
  }, top);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function position(page: Page) { return page.evaluate(() => document.body.scrollTop || window.scrollY); }
async function headerNavigate(page: Page, name: string, mobile: boolean) {
  if (mobile) {
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('navigation', { name: 'Mobile primary', exact: true }).getByRole('link', { name, exact: true }).click();
  } else await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name, exact: true }).click();
}
async function publicExamplePrices(page: Page) {
  await page.addInitScript(() => {
    const events: { type: string; at: number }[] = [];
    const requests: { path: string; at: number }[] = [];
    Object.assign(window, { publicPriceLifecycle: events, publicPriceRequests: requests });
    for (const type of ['focus', 'pageshow', 'visibilitychange']) window.addEventListener(type, () => events.push({ type, at: Date.now() }), true);
    const originalFetch = window.fetch;
    window.fetch = (input, options) => {
      const path = typeof input === 'string' ? input : input instanceof Request ? input.url : input.href;
      if (/\/api\/(landing-price-table|configurator-price)$/.test(path)) requests.push({ path, at: Date.now() });
      return originalFetch.call(window, input, options);
    };
  });
  const table = { schema: 'landing-price-table.v1', id: 'a'.repeat(64), publicationKey: 'b'.repeat(64),
    versionId: '11111111-1111-4111-8111-111111111111', versionNumber: 1,
    currency: 'NZD', includesGst: true, amounts: Array(LANDING_PRICE_CELLS).fill(12345) };
  const calls = { table: 0, canonical: 0 };
  await page.route('**/api/landing-price-table', route => {
    calls.table++;
    return route.fulfill({ json: route.request().postDataJSON().knownId
      ? { status: 'current', id: table.id, leaseMs: 30000 } : { status: 'ready', table, leaseMs: 30000 } });
  });
  await page.route('**/api/configurator-price', route => {
    calls.canonical++;
    return route.fulfill({ json: { status: 'priced', amountIncGst: 12345, breakdown: [] } });
  });
  return calls;
}

for (const width of [390, 1440]) test(`Back and Forward restore separate entries without a top flash at ${width}px`, async ({ page }, testInfo) => {
  const priceCalls = await publicExamplePrices(page);
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/'); await expect(page.locator('[data-homepage-composition]').first()).toBeVisible();
  await expect(page.locator('[data-price-example] [data-priced=true]')).toHaveCount(9);
  expect(priceCalls.table).toBeGreaterThan(0); expect(priceCalls.canonical).toBe(0);
  await scrollPage(page, 1440); const homeY = await position(page); expect(homeY).toBeGreaterThan(500);
  const sourceEntry = await page.evaluate(() => history.state?.__sanctuaryPageEntry as string);
  await headerNavigate(page, 'Projects', width < 900);
  await expect(page.locator('[data-project-card]').first()).toBeVisible();
  await scrollPage(page, 850); const projectsY = await position(page);
  const callsBeforeReturn = { ...priceCalls };
  const backFlights: string[] = [];
  const requestObserver = (request: import('@playwright/test').Request) => {
    if (new URL(request.url()).searchParams.has('_rsc')) backFlights.push(new URL(request.url()).pathname);
  };
  page.on('request', requestObserver);
  const frames = await page.evaluate(async context => {
    const start = performance.now();
    const entryBefore = history.state?.__sanctuaryPageEntry;
    const savedBefore = JSON.parse(sessionStorage.getItem('sanctuary.page-positions.v1') ?? '[]');
    const scrollCalls: {ms:number;before:number;after:number;args:unknown[];entry:string;bodyPosition:string;bodyTop:string}[] = [];
    const directScrollCalls: {ms:number;value:number;stack:string}[] = [];
    const scrollTopDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')!;
    Object.defineProperty(Element.prototype, 'scrollTop', { ...scrollTopDescriptor, set(value: number) {
      if (this === document.documentElement) directScrollCalls.push({ ms: performance.now() - start, value, stack: new Error().stack?.split('\n').slice(1, 5).join('\n') ?? '' });
      scrollTopDescriptor.set!.call(this, value);
    } });
    const nativeScroll = window.scrollTo;
    window.scrollTo = ((...args: unknown[]) => {
      const before = scrollY; Reflect.apply(nativeScroll, window, args);
      scrollCalls.push({ ms: performance.now() - start, before, after: scrollY, args, entry: history.state?.__sanctuaryPageEntry, bodyPosition: document.body.style.position, bodyTop: document.body.style.top });
    }) as typeof window.scrollTo;
    const samples: {ms:number;path:string;y:number;home:boolean;homeVisible:boolean;homeHeight:number;bodyPosition:string;bodyTop:string;height:number;bodyHeight:number;windowY:number;bodyY:number;prices: {priced: boolean;text:string}[]}[] = [];
    history.back();
    await new Promise<void>(resolve => {
      const sample = () => {
        const home = document.querySelector<HTMLElement>('[data-homepage-composition]');
        samples.push({ ms: performance.now() - start, path: location.pathname, y: document.body.scrollTop || scrollY, home: !!home, homeVisible: home?.checkVisibility() ?? false, homeHeight: home?.getBoundingClientRect().height ?? 0, bodyPosition: getComputedStyle(document.body).position, bodyTop: document.body.style.top, height: document.documentElement.scrollHeight, bodyHeight: document.body.scrollHeight, windowY: scrollY, bodyY: document.body.scrollTop,
          prices: Array.from(home?.querySelectorAll('[data-price-example] dd') ?? []).map(row => ({ priced: row.querySelector('[data-priced=true]') !== null, text: row.textContent ?? '' })) });
        if (samples.at(-1)!.home && samples.length > 8 || performance.now() - start > 3000) resolve();
        else requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    window.scrollTo = nativeScroll;
    Object.defineProperty(Element.prototype, 'scrollTop', scrollTopDescriptor);
    return { expected: context.expected, expectedEntry: context.entry, entryBefore, entryAfter: history.state?.__sanctuaryPageEntry, savedBefore, samples, scrollCalls, directScrollCalls };
  }, { expected: homeY, entry: sourceEntry });
  await page.waitForTimeout(300); // Include the ordinary canonical request debounce in the no-refetch check.
  await testInfo.attach(`return-frames-${width}`, { contentType: 'application/json', body: JSON.stringify(frames) });
  const lifecycle = await page.evaluate(() => (window as unknown as { publicPriceLifecycle: unknown[] }).publicPriceLifecycle);
  const priceRequests = await page.evaluate(() => (window as unknown as { publicPriceRequests: unknown[] }).publicPriceRequests);
  await writeFile(testInfo.outputPath('return-frames.json'), JSON.stringify({ ...frames, backFlights, priceCalls, callsBeforeReturn, lifecycle, priceRequests }, null, 2));
  const visible = frames.samples.filter(frame => frame.homeVisible && frame.path === '/');
  page.off('request', requestObserver);
  expect(backFlights.filter(path => path === '/')).toEqual([]);
  expect(frames.entryAfter).toBe(sourceEntry);
  expect(visible.length).toBeGreaterThan(0);
  expect(visible.every(frame => Math.abs(frame.y - homeY) <= 2)).toBe(true);
  expect(visible.every(frame => frame.prices.length === 9 && frame.prices.every(price => price.priced))).toBe(true);
  expect(priceCalls).toEqual(callsBeforeReturn); expect(priceCalls.canonical).toBe(0);
  expect(visible[0].ms).toBeLessThan(100);
  await expect.poll(() => position(page)).toBeCloseTo(homeY, 0);
  await page.goForward(); await expect(page.locator('[data-project-card]').first()).toBeAttached();
  await expect.poll(() => position(page)).toBeCloseTo(projectsY, 0);
  // A new visit to the same URL is a new entry, not the old Back position.
  await page.locator('.site-brand').click(); await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => position(page)).toBe(0);
  await scrollPage(page, 650); const secondHome = await position(page);
  await page.goBack(); await expect.poll(() => position(page)).toBeCloseTo(projectsY, 0);
  await page.goBack(); await expect.poll(() => position(page)).toBeCloseTo(homeY, 0);
  await page.goForward(); await page.goForward(); await expect.poll(() => position(page)).toBeCloseTo(secondHome, 0);
});

test('initial native pageshow revalidates an early table response after cold images finish loading', async ({ page }, testInfo) => {
  const calls = await publicExamplePrices(page);
  let release!: () => void; const images = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'image') { await images; await route.continue(); }
    else await route.fallback();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-price-example] [data-priced=true]')).toHaveCount(9);
    expect(calls).toEqual({ table: 1, canonical: 0 });
    release(); await page.waitForLoadState('load');
    await expect.poll(() => calls.table).toBe(2);
    const evidence = await page.evaluate(() => ({
      lifecycle: (window as unknown as { publicPriceLifecycle: { type: string; at: number }[] }).publicPriceLifecycle,
      requests: (window as unknown as { publicPriceRequests: { path: string; at: number }[] }).publicPriceRequests,
    }));
    await writeFile(testInfo.outputPath('cold-pageshow.json'), JSON.stringify({ calls, ...evidence }, null, 2));
    const shown = evidence.lifecycle.find(event => event.type === 'pageshow')!;
    expect(shown.at).toBeGreaterThanOrEqual(evidence.requests[0].at);
    expect(evidence.requests[1].at).toBeGreaterThanOrEqual(shown.at);
    expect(calls.canonical).toBe(0);
  } finally { release(); }
});

test('a product detail returns with its compatible selected price already visible and no canonical refetch', async ({ page }, testInfo) => {
  const calls = await publicExamplePrices(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/products/pergolas/gable');
  await expect(page.locator('[data-product-detail] p[data-priced=true]')).toContainText('$12,345');
  expect(calls.table).toBeGreaterThan(0); expect(calls.canonical).toBe(0);
  await headerNavigate(page, 'Projects', true); await expect(page.locator('[data-project-card]').first()).toBeVisible();
  const callsBeforeReturn = { ...calls };
  const frames = await page.evaluate(async () => {
    const start = performance.now();
    const samples: { ms: number; visible: boolean; priced: boolean; text: string }[] = [];
    history.back();
    await new Promise<void>(resolve => {
      const sample = () => {
        const root = document.querySelector<HTMLElement>('[data-product-detail]');
        const price = root?.querySelector('p[data-priced]');
        samples.push({ ms: performance.now() - start, visible: root?.checkVisibility() ?? false,
          priced: price?.getAttribute('data-priced') === 'true', text: price?.textContent ?? '' });
        if (samples.length > 8 && root?.checkVisibility() || performance.now() - start > 3000) resolve();
        else requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    return samples;
  });
  await page.waitForTimeout(300);
  await writeFile(testInfo.outputPath('product-return-frames.json'), JSON.stringify({ frames, calls, callsBeforeReturn }, null, 2));
  const visible = frames.filter(frame => frame.visible);
  expect(visible.length).toBeGreaterThan(0); expect(visible[0].ms).toBeLessThan(100);
  expect(visible.every(frame => frame.priced && frame.text.includes('$12,345'))).toBe(true);
  expect(calls).toEqual(callsBeforeReturn); expect(calls.canonical).toBe(0);
});

test('mobile contact draft restores its last edit, pathway, optional details and actual file bytes after reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/contact');
  await page.locator('#contact-pathway-custom').check();
  await page.locator('#contact-name').fill('Synthetic draft visitor');
  await page.locator('#contact-email').fill('draft@example.test');
  await page.locator('#contact-phone').fill('0221234567');
  await page.locator('#contact-message').fill('Please preserve this last edit.');
  await page.locator('[name=budgetPreference]').selectOption('provided');
  await page.locator('[name=budgetHint]').fill('A synthetic range');
  await page.locator('[name=files]').setInputFiles({ name: 'synthetic-site.png', mimeType: 'image/png', buffer: Buffer.from('synthetic attachment bytes') });
  await expect(page.locator('[aria-label="Selected files"]')).toContainText('synthetic-site.png');
  // Wait for the actual IndexedDB commit, not just a filename marker or component state.
  await expect.poll(() => page.evaluate(async () => {
    return new Promise<boolean>(resolve => {
      const request = indexedDB.open('sanctuary-enquiry-drafts-v1', 1);
      request.onsuccess = () => { const db = request.result; const tx = db.transaction('files'); const rows = tx.objectStore('files').getAll(); rows.onsuccess = () => resolve(rows.result.some(row => row.files?.[0]?.blob?.size === 26)); tx.oncomplete = () => db.close(); };
      request.onerror = () => resolve(false);
    });
  })).toBe(true);
  await page.reload();
  await expect(page.locator('#contact-name')).toHaveValue('Synthetic draft visitor');
  await expect(page.locator('#contact-message')).toHaveValue('Please preserve this last edit.');
  await expect(page.locator('[name=budgetHint]')).toHaveValue('A synthetic range');
  await expect(page.locator('[aria-label="Selected files"]')).toContainText('synthetic-site.png');
  await expect(page.locator('[data-contact-pathway]')).toHaveAttribute('data-contact-pathway', 'custom');
  await expect(page.locator('form')).toHaveAttribute('action', '/api/enquiry/fallback');
  await page.locator('button[type=submit]').click();
  // Signing was refused; the file and text remain for a real retry.
  await expect(page.locator('.contact-form__submit-error')).toContainText('We could not upload your attachments');
  await expect(page.locator('#contact-name')).toHaveValue('Synthetic draft visitor');
  let uploadedBytes = false;
  let sentPayload: Record<string, unknown> | undefined;
  await page.route('**/api/enquiry/attachments/sign', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    uploadSessionToken: 'synthetic-upload-session', uploads: [{ path: 'pending/synthetic/site.png', token: 'synthetic-upload-token' }],
  }) }));
  await page.route('**/storage/v1/object/upload/sign/enquiry-attachments/**', async route => {
    uploadedBytes = route.request().postDataBuffer()?.includes(Buffer.from('synthetic attachment bytes')) === true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'enquiry-attachments/pending/synthetic/site.png' }) });
  });
  await page.route('**/api/enquiry', async route => {
    sentPayload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.locator('button[type=submit]').click();
  await expect(page.locator('.contact-success')).toBeVisible();
  expect(uploadedBytes).toBe(true);
  expect(sentPayload).toMatchObject({ name: 'Synthetic draft visitor', files: [{ name: 'synthetic-site.png', size: 26, type: 'image/png', path: 'pending/synthetic/site.png' }] });
  await page.reload(); await expect(page.locator('#contact-name')).toHaveCount(0);
  // A fresh draft can also be explicitly discarded immediately before navigation.
  await page.locator('#contact-pathway-help').check();
  await page.locator('#contact-name').fill('Discarded synthetic draft');
  await page.locator('[name=files]').setInputFiles({ name: 'discarded.png', mimeType: 'image/png', buffer: Buffer.from('discarded synthetic bytes') });
  await page.getByRole('button', { name: 'Clear draft', exact: true }).click();
  await page.reload(); await expect(page.locator('#contact-name')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => new Promise<number>(resolve => {
    const request = indexedDB.open('sanctuary-enquiry-drafts-v1', 1);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('files'); const rows = tx.objectStore('files').getAll(); rows.onsuccess = () => resolve(rows.result.length); tx.oncomplete = () => db.close(); };
  }))).toBe(0);
});

test('shared SEO form restores a brief, explains an edited replay and clears a confirmed fresh send', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/architects-designers-builders');
  const form = page.locator('form.acrylic-form');
  await form.locator('[name=name]').fill('Synthetic professional');
  await form.locator('[name=phone]').fill('0221234567');
  await form.locator('[name=email]').fill('professional@example.test');
  await form.locator('[name=message]').fill('A synthetic professional brief.');
  await page.reload();
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic professional');
  const attempts: Record<string, unknown>[] = [];
  await page.route('**/api/enquiry', async route => {
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) await route.abort('failed');
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, idempotentReplay: true }) });
  });
  await form.locator('button[type=submit]').click();
  await expect(form.locator('[role=alert]').last()).toBeVisible();
  await form.locator('[name=message]').fill('Later synthetic edits after the lost response.');
  await form.locator('button[type=submit]').click();
  await expect(form.getByRole('status')).toContainText('Your earlier enquiry was received.');
  await expect(form.getByRole('status')).toContainText('Changes made after your first send attempt are not included');
  expect(attempts).toHaveLength(2);
  expect(attempts[1].submissionId).toBe(attempts[0].submissionId);
  await page.reload();
  await expect(form.locator('[name=message]')).toHaveValue('Later synthetic edits after the lost response.');
  await page.route('**/api/enquiry', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await form.locator('button[type=submit]').click();
  await expect(form.getByRole('status')).toContainText('Project brief sent');
  await page.reload(); await expect(form.locator('[name=name]')).toHaveValue('');
});

test('projects filtered collection return coexists with entry restoration on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects?audience=residential');
  const card = page.locator('[data-project-card]').nth(3);
  await card.scrollIntoViewIfNeeded(); const before = await position(page);
  await card.click(); await expect(page.locator('[data-project-case-study]')).toBeVisible();
  await page.locator('[data-all-projects]').click();
  await expect(page).toHaveURL(/\/projects\?audience=residential$/);
  await expect.poll(() => position(page)).toBeCloseTo(before, 0);
  await page.locator('[data-project-card]').nth(3).click(); await page.goBack();
  await expect.poll(() => position(page)).toBeCloseTo(before, 0);
});

test('new fragment navigation reaches its responsive section and Back restores the source position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/contact'); await page.locator('#contact-pathway-help').check();
  await scrollPage(page, 600); const before = await position(page);
  await page.evaluate(() => {
    const link = document.createElement('a'); link.href = '/privacy#advertising-measurement'; link.textContent = 'Synthetic fragment check'; document.body.append(link); link.click();
  });
  await expect(page.locator('#advertising-measurement')).toBeInViewport();
  await page.goBack(); await expect(page.locator('#contact-pathway-help')).toBeChecked();
  await expect.poll(() => position(page)).toBeCloseTo(before, 0);
  await page.evaluate(() => {
    const link = document.createElement('a'); link.href = '#contact-form'; link.textContent = 'Synthetic same-page fragment'; document.body.append(link); link.click();
  });
  await expect(page).toHaveURL(/#contact-form$/);
  const fragmentY = await position(page);
  await page.goBack(); await expect.poll(() => position(page)).toBeCloseTo(before, 0);
  await page.goForward(); await expect(page).toHaveURL(/#contact-form$/);
  await expect.poll(() => position(page)).toBeCloseTo(fragmentY, 0);
});

test('a returned page renews its retained price lease and stays priced past the original expiry', async ({ page }) => {
  const table = { schema: 'landing-price-table.v1', id: 'a'.repeat(64), publicationKey: 'b'.repeat(64),
    versionId: '11111111-1111-4111-8111-111111111111', versionNumber: 1,
    currency: 'NZD', includesGst: true, amounts: Array(LANDING_PRICE_CELLS).fill(12345) };
  const requests: { time: number; body: Record<string, unknown> }[] = [];
  await page.route('**/api/landing-price-table', async route => {
    const body = route.request().postDataJSON(); requests.push({ time: Date.now(), body });
    await route.fulfill({ json: body.knownId ? { status: 'current', id: table.id, leaseMs: 30000 }
      : { status: 'ready', table, leaseMs: 30000 } });
  });
  await page.route('**/api/pergola-selection', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/configurator-price', route => route.fulfill({ json: { status: 'unavailable' } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/pergola-cost-auckland');
  const estimate = page.locator('#explore-options [data-estimate-state]');
  await expect(estimate).toHaveAttribute('data-estimate-state', 'priced');
  await expect(estimate).toContainText('$12,345');
  await headerNavigate(page, 'Projects', false);
  await expect(page.locator('[data-project-card]').first()).toBeVisible();
  await page.waitForTimeout(1000);
  await page.goBack(); await expect(estimate).toHaveAttribute('data-estimate-state', 'priced');
  expect(requests).toHaveLength(1);
  await page.evaluate(() => {
    const target = document.querySelector('#explore-options [data-estimate-state]')!;
    const seen = { states: [target.getAttribute('data-estimate-state')] };
    Object.assign(window, { leaseReturnEvidence: seen });
    new MutationObserver(() => seen.states.push(target.getAttribute('data-estimate-state')))
      .observe(target, { subtree: true, attributes: true, childList: true });
  });
  await expect.poll(() => requests.length, { timeout: 20000 }).toBeGreaterThanOrEqual(2);
  expect(requests[1].body).toEqual({ knownId: table.id });
  expect(requests[1].time - requests[0].time).toBeLessThan(20000);
  await page.waitForTimeout(Math.max(0, requests[0].time + 31000 - Date.now()));
  await expect(estimate).toHaveAttribute('data-estimate-state', 'priced');
  await expect(estimate).toContainText('$12,345');
  const states = await page.evaluate(() => (window as unknown as { leaseReturnEvidence: { states: string[] } }).leaseReturnEvidence.states);
  expect(states.length).toBeGreaterThan(0);
  expect(states.every(state => state === 'priced')).toBe(true);
});
