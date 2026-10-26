import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

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

for (const method of ['Back', 'All projects'] as const) test(`${method} returns to the collection and yields to early touch without a late image jump`, async ({ page, context, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Chromium native touch protocol; physical iPhone Safari remains a separate check.');
  await page.addInitScript(() => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, version: 1, updatedAt: new Date().toISOString() }));
    const inputs: { type: string; at: number; trusted: boolean; prevented: boolean }[] = [];
    Object.assign(window, { projectReturnInputs: inputs });
    for (const type of ['touchstart', 'touchmove', 'touchend']) window.addEventListener(type, event => {
      queueMicrotask(() => inputs.push({ type, at: performance.now(), trusted: event.isTrusted, prevented: event.defaultPrevented }));
    }, { passive: true });
  });
  await page.route('**/api/enquiry**', route => route.abort());
  const cdp = await context.newCDPSession(page);
  await page.goto('/projects?audience=residential');
  await expect(page.locator('[data-project-card]').first()).toBeVisible();
  const controlDown = await touchScroll(page, cdp, false);
  expect(controlDown).toBeGreaterThan(200); // Same trusted input must scroll before navigation.
  expect(await touchScroll(page, cdp, true)).toBeLessThan(controlDown - 200);
  await page.evaluate(() => document.body.scrollTo({ top: 1266, behavior: 'instant' }));
  const card = page.locator('[data-project-card="mt-maunganui-box"]');
  await card.locator('img').evaluate(image => image.decode());
  const before = await card.evaluate(el => ({ y: document.body.scrollTop || scrollY, bottom: el.getBoundingClientRect().bottom, src: el.querySelector('img')!.currentSrc }));
  // Activate a visible part of the actual card without scrollIntoView changing the source coordinate.
  await page.touchscreen.tap(195, Math.round(Math.min(780, Math.max(130, before.bottom - 50))));
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
  expect(samples.every(sample => sample.visible && sample.complete && sample.opacity === '1' && sample.src === before.src)).toBe(true);
  expect(samples.every(sample => Math.abs(sample.width - samples[0].width) < 1 && Math.abs(sample.height - samples[0].height) < 1)).toBe(true);
  expect(afterUp).toBeLessThan(settled - 200);
  expect(afterDown).toBeGreaterThan(afterUp + 200);
  expect(inputs.length).toBeGreaterThan(10);
  expect(inputs.every(input => input.trusted && !input.prevented)).toBe(true);
});
