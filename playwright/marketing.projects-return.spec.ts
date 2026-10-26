import { expect, test, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

// Playwright route interception disables HTTP caching. Keep the warm-return lane
// on native browser caching while blocking external requests and every write.
async function nativePageTransport(page: Page, context: BrowserContext, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const cdp = await context.newCDPSession(page);
  cdp.on('Fetch.requestPaused', event => {
    let allowed = false;
    try { allowed = new URL(event.request.url).origin === origin && ['GET', 'HEAD'].includes(event.request.method); } catch { /* Malformed URLs fail closed. */ }
    void cdp.send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed
      ? { requestId: event.requestId }
      : { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {
      // Target closure cancels requests. Never continue a failed/paused request.
    });
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  return cdp;
}
test.afterEach(async ({ page }) => {
  // Close the target with its fence still active, cancelling any paused requests.
  await page.close({ runBeforeUnload: false });
});

function photoIdentity(source: string, origin: string) {
  if (!source) return '';
  const optimized = new URL(source, origin);
  return new URL(optimized.pathname === '/_next/image' ? optimized.searchParams.get('url') ?? optimized.href : optimized.href, optimized.origin).href;
}

async function touchScroll(page: Page, cdp: CDPSession, up: boolean) {
  const start = up ? 200 : 650, end = up ? 650 : 200;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: start, id: 1 }] });
  for (let n = 1; n <= 12; n++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: Math.round(start + (end - start) * n / 12), id: 1 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  return page.evaluate(() => document.body.scrollTop || scrollY);
}

for (const method of ['Back', 'All projects'] as const) test(`${method} returns to the collection and yields to early touch without a late image jump`, async ({ page, context, browserName, baseURL }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Chromium native touch protocol; physical iPhone Safari remains a separate check.');
  await page.addInitScript(() => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, version: 1, updatedAt: new Date().toISOString() }));
    const inputs: { type: string; at: number; trusted: boolean; prevented: boolean }[] = [];
    const activations: { type: string; at: number; trusted: boolean; prevented: boolean; card: string | null }[] = [];
    Object.assign(window, { projectReturnInputs: inputs, projectReturnActivations: activations });
    for (const type of ['touchstart', 'touchmove', 'touchend']) window.addEventListener(type, event => {
      queueMicrotask(() => inputs.push({ type, at: performance.now(), trusted: event.isTrusted, prevented: event.defaultPrevented }));
    }, { passive: true });
    for (const type of ['pointerdown', 'pointerup', 'click']) window.addEventListener(type, event => {
      queueMicrotask(() => activations.push({ type, at: performance.now(), trusted: event.isTrusted, prevented: event.defaultPrevented,
        card: (event.target as Element | null)?.closest('[data-project-card]')?.getAttribute('data-project-card') ?? null }));
    }, { passive: true });
  });
  const cdp = await nativePageTransport(page, context, baseURL!);
  await page.goto('/projects?audience=residential');
  await expect(page.locator('[data-project-card]').first()).toBeVisible();
  const controlDown = await touchScroll(page, cdp, false);
  expect(controlDown).toBeGreaterThan(200); // Same trusted input must scroll before navigation.
  expect(await touchScroll(page, cdp, true)).toBeLessThan(controlDown - 200);
  await page.evaluate(() => {
    const body = document.body;
    const bodyOwnsScroll = /^(auto|scroll|overlay)$/.test(getComputedStyle(body).overflowY) && body.scrollHeight > body.clientHeight + 1;
    if (bodyOwnsScroll) body.scrollTo({ top: 1266, behavior: 'instant' });
    else window.scrollTo({ top: 1266, behavior: 'instant' });
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const card = page.locator('[data-project-card="mt-maunganui-box"]');
  await card.locator('img').evaluate(image => image.decode());
  const before = await card.evaluate(el => ({ y: document.body.scrollTop || scrollY, bottom: el.getBoundingClientRect().bottom, src: el.querySelector('img')!.currentSrc }));
  const tapY = Math.round(Math.min(780, Math.max(130, before.bottom - 50)));
  const preparation = await page.evaluate(tapY => ({ windowY: scrollY, bodyY: document.body.scrollTop,
    hit: document.elementFromPoint(195, tapY)?.closest('[data-project-card]')?.getAttribute('data-project-card'),
    inputs: (window as unknown as { projectReturnInputs: unknown[] }).projectReturnInputs }), tapY);
  await writeFile(testInfo.outputPath('project-return-pre-navigation.json'), JSON.stringify({ method, before, tapY, ...preparation }, null, 2));
  expect(preparation.windowY).toBeCloseTo(1266, 0); expect(preparation.bodyY).toBe(0);
  expect(preparation.hit).toBe('mt-maunganui-box');
  // Activate a visible part of the actual card without scrollIntoView changing the source coordinate.
  await page.touchscreen.tap(195, tapY);
  const activation = await page.evaluate(() => ({ path: location.pathname,
    events: (window as unknown as { projectReturnActivations: unknown[] }).projectReturnActivations })).catch(error => ({ snapshotError: String(error) }));
  await writeFile(testInfo.outputPath('project-return-activation.json'), JSON.stringify(activation, null, 2));
  await expect(page.locator('[data-project-case-study]')).toBeVisible();
  if (method === 'All projects') await expect(page.locator('[data-all-projects]')).toBeVisible();
  const sampler = page.evaluate(async method => {
    const samples: { ms: number; y: number; visible: boolean; src: string; opacity: string; complete: boolean; width: number; height: number }[] = [];
    const started = performance.now();
    if (method === 'Back') history.back();
    await new Promise<void>(resolve => {
      const frame = () => {
        const list = document.querySelector('[data-project-collection=true]');
        const image = list?.querySelector<HTMLImageElement>('[data-project-card="mt-maunganui-box"] img');
        if (location.pathname === '/projects' && list?.checkVisibility() && image) {
          const rect = image.getBoundingClientRect();
          samples.push({ ms: performance.now() - started, y: document.body.scrollTop || scrollY, visible: image.checkVisibility(), src: image.currentSrc,
            opacity: getComputedStyle(image).opacity, complete: image.complete && image.naturalWidth > 0, width: rect.width, height: rect.height });
        }
        if (performance.now() - started > 1700) resolve(); else requestAnimationFrame(frame);
      }; requestAnimationFrame(frame);
    });
    return samples;
  }, method);
  if (method === 'All projects') await page.locator('[data-all-projects]').tap();
  await page.waitForURL('**/projects?audience=residential');
  await expect(page.locator('[data-project-collection=true]')).toBeVisible();
  await page.waitForTimeout(70);
  const earlyUp = await touchScroll(page, cdp, true);
  const samples = await sampler;
  const settled = await page.evaluate(() => document.body.scrollTop || scrollY);
  const afterUp = await touchScroll(page, cdp, true), afterDown = await touchScroll(page, cdp, false);
  const inputs = await page.evaluate(() => (window as unknown as { projectReturnInputs: { trusted: boolean; prevented: boolean }[] }).projectReturnInputs);
  await writeFile(testInfo.outputPath('project-return.json'), JSON.stringify({ method, before, controlDown, earlyUp, settled, afterUp, afterDown, samples, inputs }, null, 2));
  await page.screenshot({ path: testInfo.outputPath('project-return.png') });
  expect(samples.length).toBeGreaterThan(10);
  expect(samples[0].y).toBeCloseTo(before.y, 0);
  expect(earlyUp).toBeLessThan(before.y - 200);
  expect(settled).toBeCloseTo(earlyUp, 0);
  // No restoration write may move against the upward gesture, including the old ~0.5s frame.
  expect(samples.every((sample, i) => i === 0 || sample.y <= samples[i - 1].y + 2)).toBe(true);
  expect(samples.every(sample => sample.visible && sample.complete && sample.opacity === '1' && photoIdentity(sample.src, baseURL!) === photoIdentity(before.src, baseURL!))).toBe(true);
  expect(samples.every(sample => Math.abs(sample.width - samples[0].width) < 1 && Math.abs(sample.height - samples[0].height) < 1)).toBe(true);
  expect(afterUp).toBeLessThan(settled - 200);
  expect(afterDown).toBeGreaterThan(afterUp + 200);
  expect(inputs.length).toBeGreaterThan(10);
  expect(inputs.every(input => input.trusted && !input.prevented)).toBe(true);
});

test('ordinary mobile pages use the viewport scroller and retain menu locking', async ({ page, context, browserName, baseURL }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Native touch protocol verifies ownership; Safari elasticity needs hardware.');
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, version: 1, updatedAt: new Date().toISOString() })));
  const cdp = await nativePageTransport(page, context, baseURL!);
  const pages = [];
  for (const width of [390, 920]) for (const path of ['/projects', '/', '/products/pergolas/pitched', '/contact']) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(path);
    const down = await touchScroll(page, cdp, false);
    const state = await page.evaluate(() => ({ windowY: scrollY, bodyY: document.body.scrollTop,
      owner: document.scrollingElement?.tagName, width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
      overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY }));
    expect(state.owner).toBe('HTML'); expect(state.bodyY).toBe(0);
    expect(state.windowY).toBeGreaterThan(200); expect(state.width).toBeLessThanOrEqual(state.viewport);
    expect(state.overscroll).toBe('auto'); // Native viewport edge behavior remains available.
    if (path === '/projects' && width === 390) {
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      await expect(page.locator('body')).toHaveCSS('position', 'fixed');
      const pinnedTop = await page.locator('body').evaluate(body => body.style.top);
      await touchScroll(page, cdp, false);
      expect(await page.locator('body').evaluate(body => body.style.top)).toBe(pinnedTop);
      await page.getByRole('button', { name: 'Close menu', exact: true }).last().click();
      await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(down, 0);
    }
    const up = await touchScroll(page, cdp, true);
    expect(up).toBeLessThan(down - 200);
    pages.push({ path, viewportWidth: width, down, up, ...state });
  }
  await writeFile(testInfo.outputPath('native-viewport-ownership.json'), JSON.stringify(pages, null, 2));
});

test('a stored BODY position reloads into the native viewport without losing collection context', async ({ page, context, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Native touch protocol verifies recovery; physical Safari remains separate.');
  await page.addInitScript(() => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, version: 1, updatedAt: new Date().toISOString() }));
    history.replaceState({ ...history.state, __sanctuaryPageEntry: 'legacy-body-projects' }, '', location.href);
    sessionStorage.setItem('sanctuary.page-positions.v1', JSON.stringify([
      ['legacy-body-projects', { saved: Date.now(), position: { x: 0, y: 0, body: 1266, containers: [0] } }],
    ]));
  });
  const cdp = await nativePageTransport(page, context, baseURL!);
  await page.goto('/projects?audience=residential');
  await expect(page.locator('[data-project-collection=true]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(1266, 0);
  expect(await page.evaluate(() => document.body.scrollTop)).toBe(0);
  await expect(page.getByLabel('Filter by audience')).toHaveValue('residential');
  const up = await touchScroll(page, cdp, true), down = await touchScroll(page, cdp, false);
  expect(up).toBeLessThan(1066); expect(down).toBeGreaterThan(up + 200);
});
