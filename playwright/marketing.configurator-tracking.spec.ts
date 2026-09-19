import { expect, test, type Page } from '@playwright/test';

async function events(page: Page) {
  return page.evaluate(() => ((window as unknown as { dataLayer: unknown[][] }).dataLayer || [])
    .filter(item => item[0] === 'event').map(item => ({ name: item[1], properties: item[2] })));
}

for (const allowed of [false, true]) test(`mobile finish respects analytics consent: ${allowed}`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Never send test conversions or customer enquiries to external services.
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.addInitScript(allow => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: allow, marketing: false, updatedAt: new Date().toISOString(), version: 1 }));
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => '00000000-0000-4000-8000-000000000001' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {
      if (sessionStorage.getItem('share-result') === 'cancel') throw new DOMException('Cancelled', 'AbortError');
      if (sessionStorage.getItem('share-result') === 'error') throw new Error('Unavailable');
    } });
  }, allowed);
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  for (const name of ['Set your size', 'Add sides & lighting', 'See your pergola', 'Review your design']) {
    await page.getByRole('button', { name, exact: true }).click();
  }
  const share = page.getByRole('button', { name: 'Share design', exact: true });
  await page.evaluate(() => sessionStorage.setItem('share-result', 'cancel'));
  await share.click(); await expect(share).toBeEnabled();
  expect((await events(page)).filter(e => e.name === 'design_share')).toHaveLength(0);
  await page.evaluate(() => sessionStorage.setItem('share-result', 'success'));
  await share.click(); await expect(page.getByText('Design link shared.', { exact: true })).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('share-result', 'error'));
  await share.click(); await expect(page.getByRole('textbox', { name: 'Design link' })).toBeVisible();
  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  await page.locator('#contact-name').fill('Tracking Test');
  await page.locator('#contact-suburb').fill('Synthetic suburb');
  await page.locator('#contact-email').fill('tracking@example.com');
  await page.getByRole('button', { name: 'Enquire about this design', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Design saved. Enquiry sent.' })).toBeVisible();
  const captured = await events(page);
  for (const name of ['design_start', 'design_edit', 'design_review', 'design_share', 'design_share_link_ready', 'design_enquiry_open', 'contact_start', 'contact_success']) {
    expect(captured.filter(event => event.name === name), name).toHaveLength(allowed ? 1 : 0);
  }
  expect(captured.filter(event => event.name === 'design_share_open')).toHaveLength(allowed ? 3 : 0);
  const serialized = JSON.stringify(captured);
  for (const sensitive of ['Tracking Test', 'Synthetic suburb', 'tracking@example.com', '#design=', 'widthMm', 'projectionMm']) expect(serialized).not.toContain(sensitive);
  for (const width of [1280, 390, 1024, 390]) {
    await page.setViewportSize({ width, height: 844 });
    if (width === 390) await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-mobile-step', 'review');
    else await expect(page.getByRole('button', { name: '3 Review', exact: true })).toBeVisible();
  }
  const rotated = await events(page);
  for (const name of ['design_start', 'design_review']) expect(rotated.filter(event => event.name === name), name).toHaveLength(allowed ? 1 : 0);
});
