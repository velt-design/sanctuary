import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

async function fencedPhotos(page: Page, baseURL: string, asset: string, fail = false) {
  const origin = new URL(baseURL).origin;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let available = false;
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, version: 1, updatedAt: new Date().toISOString() })));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method())) return route.abort();
    if (url.pathname === '/_next/image' && url.searchParams.get('url') === asset && !available) {
      if (fail) return route.abort();
      await gate;
    }
    return route.continue();
  });
  return () => { available = true; release(); };
}

async function readyPhoto(page: Page, owner: string) {
  const photo = page.locator(`${owner} [data-decoded-photo=shown]`);
  await photo.scrollIntoViewIfNeeded(); await photo.evaluate(image => (image as HTMLImageElement).decode());
  await expect(photo).toBeVisible();
  return photo;
}

test('roof reselection keeps an opaque photograph and caption until the newest photo decodes', async ({ page, baseURL }, testInfo) => {
  const release = await fencedPhotos(page, baseURL!, '/images/timber-gable-ceiling.jpg');
  try {
    await page.goto('/products/pergolas/gable', { waitUntil: 'domcontentloaded' });
    await page.getByText('Compare acrylic, solid and mixed roofing', { exact: true }).click();
    const owner = '[class*="roofImage"]', photo = await readyPhoto(page, owner);
    const initial = await photo.getAttribute('src');
    const samples = page.evaluate(async () => {
      const rows: { src: string; complete: boolean; opacity: string; width: number; height: number; top: number }[] = [];
      const start = performance.now();
      await new Promise<void>(resolve => {
        const frame = () => {
          const image = document.querySelector<HTMLImageElement>('[class*="roofImage"] [data-decoded-photo=shown]')!;
          const rect = image.getBoundingClientRect();
          rows.push({ src: image.currentSrc, complete: image.complete && image.naturalWidth > 0, opacity: getComputedStyle(image).opacity, width: rect.width, height: rect.height, top: rect.top });
          if (performance.now() - start > 1200) resolve(); else requestAnimationFrame(frame);
        }; requestAnimationFrame(frame);
      }); return rows;
    });
    await page.getByRole('radio', { name: '02 Solid: An opaque shade condition', exact: true }).check();
    await expect(page.locator(`${owner} [data-decoded-photo=incoming]`)).toHaveCount(1);
    await expect(photo).toHaveAttribute('src', initial!);
    await expect(page.locator(`${owner} figcaption`)).toHaveText('Acrylic roofing reference');
    await page.getByRole('radio', { name: '03 Combination: Daylight and shade in zones', exact: true }).check();
    await expect(photo).toHaveAttribute('src', /project-warkworth-outdoor-room-04/);
    await expect(page.locator(`${owner} figcaption`)).toHaveText('Mixed roof zones at Warkworth');
    release();
    const rows = await samples;
    await writeFile(testInfo.outputPath('roof-photo-frames.json'), JSON.stringify(rows, null, 2));
    await page.screenshot({ path: testInfo.outputPath('roof-photo.png') });
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every(row => row.complete && row.opacity === '1')).toBe(true);
    expect(rows.every(row => Math.abs(row.width - rows[0].width) < 1 && Math.abs(row.height - rows[0].height) < 1 && Math.abs(row.top - rows[0].top) < 1)).toBe(true);
    await expect(photo).toHaveAttribute('src', /project-warkworth-outdoor-room-04/);
  } finally { release(); }
});

test('a failed roof photo preserves the useful reference and a nearby retry recovers it', async ({ page, baseURL }) => {
  const recover = await fencedPhotos(page, baseURL!, '/images/timber-gable-ceiling.jpg', true);
  await page.goto('/products/pergolas/gable', { waitUntil: 'domcontentloaded' });
  await page.getByText('Compare acrylic, solid and mixed roofing', { exact: true }).click();
  const owner = '[class*="roofImage"]', photo = await readyPhoto(page, owner);
  const initial = await photo.getAttribute('src');
  await page.getByRole('radio', { name: '02 Solid: An opaque shade condition', exact: true }).check();
  const retry = page.locator(`${owner} button`).filter({ hasText: 'Retry' });
  await expect(retry).toBeVisible(); await expect(photo).toHaveAttribute('src', initial!);
  await expect(page.locator(`${owner} figcaption`)).toContainText('Acrylic roofing reference');
  expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  recover(); await retry.click();
  await expect(photo).toHaveAttribute('src', /timber-gable-ceiling/);
  await expect(retry).toHaveCount(0);
  expect(await photo.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
});

test('blind-state photos use the same retained decode contract', async ({ page, baseURL }) => {
  const release = await fencedPhotos(page, baseURL!, '/images/blind-opening-raised.webp');
  try {
    await page.goto('/pergolas-with-blinds', { waitUntil: 'domcontentloaded' });
    const photo = await readyPhoto(page, '#blind-state-photo');
    await page.getByRole('button', { name: 'Raised', exact: true }).click();
    await expect(photo).toHaveAttribute('src', /blind-opening-lowered/);
    await expect(page.locator('#blind-state-photo figcaption')).toContainText('lowered');
    release(); await expect(photo).toHaveAttribute('src', /blind-opening-raised/);
    await expect(page.locator('#blind-state-photo figcaption')).toContainText('raised');
    expect(await photo.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  } finally { release(); }
});
