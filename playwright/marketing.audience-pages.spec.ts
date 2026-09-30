import { expect, test } from '@playwright/test';

const pages = [
  { route: '/commercial-pergolas-auckland', audience: 'commercial', title: 'Make more of your outdoor space.', action: 'Discuss your venue', projects: '#commercial-projects' },
  { route: '/architects-designers-builders', audience: 'professional', title: 'Bring us into the design.', action: 'Discuss a project', projects: '#professional-projects' },
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
  await page.route(/google-analytics|googletagmanager|clarity\.ms|facebook\.com/, route => route.abort());
  await page.route(/\/api\/(enquiry|contact)(?:\/|\?|$)/, route => route.abort());
});

for (const entry of pages) for (const width of [320, 390, 1440]) test(`${entry.audience} normal entry, proof and form at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const response = await page.goto(entry.route);
  expect(response?.status()).toBe(200);
  const robotsHeader = response?.headers()['x-robots-tag'] ?? '';
  if (new URL(page.url()).hostname.endsWith('.vercel.app')) expect(robotsHeader).toContain('noindex');
  else expect(robotsHeader).not.toContain('noindex');
  await expect(page.locator('h1')).toHaveText(entry.title);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(entry.route + '$'));
  const proof = page.locator(entry.projects);
  await page.locator(`main header a[href="${entry.projects}"]`).click();
  await expect(proof).toBeInViewport();
  for (const image of await proof.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  }
  const heroAction = page.locator('main header').getByRole('link', { name: entry.action });
  await heroAction.click();
  await expect(page.locator('#project-details')).toBeInViewport();
  await expect(page.locator('#acrylic-enquiry-type')).toHaveValue(entry.audience);
  await expect(page.locator('#acrylic-enquiry-files')).toHaveAttribute('accept', '.pdf,.jpg,.jpeg,.png,.webp');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const link of await page.locator('main header a').all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

for (const entry of pages) test(`${entry.audience} upload failure and retry preserve the intercepted brief and context`, async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  let calls = 0;
  await page.route('**/api/enquiry', async route => {
    payload = route.request().postDataJSON(); calls++;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/enquiry/attachments/sign', route => route.fulfill({ status: 503, json: { ok: false } }));
  await page.goto(entry.route);
  await page.locator('main header').getByRole('link', { name: entry.action }).click();
  await page.locator('#acrylic-enquiry-name').fill('Synthetic Venue Test');
  await page.locator('#acrylic-enquiry-phone').fill('021 000 0000');
  await page.locator('#acrylic-enquiry-email').fill('synthetic@example.com');
  await page.locator('#acrylic-enquiry-message').fill('An early outdoor-space brief.');
  await page.locator('#acrylic-enquiry-files').setInputFiles({ name: 'synthetic-plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nsynthetic') });
  await page.getByRole('button', { name: 'Send project brief', exact: true }).click();
  await expect(page.getByText('We could not upload your attachments. Please try again or remove them before submitting.', { exact: true })).toBeVisible();
  expect(calls).toBe(0);
  await expect(page.locator('#acrylic-enquiry-name')).toHaveValue('Synthetic Venue Test');
  await page.getByRole('button', { name: 'Remove synthetic-plan.pdf', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Selected files' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Send project brief', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Project brief sent.' })).toBeVisible();
  expect(payload).toMatchObject({ enquiryType: entry.audience, page: entry.route, enquiryContext: { enquiry_type: entry.audience, source_path: entry.route, source_component: 'embedded_form' } });
});

test('default SEO renderer keeps its hero, content and embedded form', async ({ page }) => {
  await page.goto('/custom-pergolas-auckland');
  await expect(page.locator('[data-editorial-landing-hero] h1')).toBeVisible();
  expect(await page.locator('main section').count()).toBeGreaterThan(3);
  await expect(page.locator('#project-details form')).toHaveCount(1);
  await expect(page.locator('main [data-editorial-landing-hero] a[href="#project-details"]')).toHaveCount(1);
});

test('guided audience context takes precedence over the route form fallback', async ({ page }) => {
  for (const entry of [
    { route: '/commercial-pergolas-auckland?sector=workplace&role=collaborate', audience: 'commercial', focus: 'collaborate' },
    { route: '/architects-designers-builders?stage=delivery&need=delivery-coordination', audience: 'professional', focus: 'delivery-coordination' },
  ]) {
    await page.goto(entry.route);
    await expect(page.locator('[data-guided-journey-context]')).toBeVisible();
    const context = JSON.parse(await page.locator('input[name="enquiryContext"]').inputValue());
    expect(context).toMatchObject({ enquiry_type: entry.audience, source_component: 'embedded_form', source_experience: 'guided-home-v1', source_focus: entry.focus });
    await expect(page.locator('[data-guided-journey-context]').getByRole('link', { name: 'Change answers' })).toHaveAttribute('href', /home-guided\?/);
  }
});
