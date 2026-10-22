import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
  await page.route('**/api/enquiry', route => route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('rapid filter edits compose and survive history, reload, project return and reset', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/projects?utm_source=journey');
  await expect(page.getByLabel('View scale')).toBeVisible();
  // Same browser task reproduces the stale route-prop race, without waiting for a render.
  await page.evaluate(() => {
    for (const [label, value] of [['Filter by audience', 'residential'], ['Filter by roof form', 'gable']]) {
      const select = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await expect(page).toHaveURL(/utm_source=journey&audience=residential&form=gable$/);
  await expect(page.locator('[data-project-card]')).toHaveCount(4);
  await expect(page.getByLabel('Filter by audience')).toHaveValue('residential');
  await expect(page.getByLabel('Filter by roof form')).toHaveValue('gable');
  await page.goBack();
  await expect(page.locator('[data-project-card]')).toHaveCount(10);
  await expect(page.getByLabel('Filter by roof form')).toHaveValue('all');
  await page.goForward();
  await expect(page.locator('[data-project-card]')).toHaveCount(4);
  await page.reload();
  await expect(page.locator('[data-project-card]')).toHaveCount(4);
  await page.locator('[data-project-card][href*="warkworth-outdoor-room"]').click();
  await expect(page.locator('h1')).toHaveText('Warkworth Outdoor Room');
  await page.locator('[data-all-projects]').click();
  await expect(page.locator('[data-project-card]')).toHaveCount(4);
  await expect(page.getByLabel('Filter by audience')).toHaveValue('residential');
  await page.locator('[data-project-card]').first().click();
  await page.goBack();
  await expect(page.locator('[data-project-card]')).toHaveCount(4);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page).toHaveURL(/\/projects\?utm_source=journey$/);
  await expect(page.locator('[data-project-card]')).toHaveCount(15);
});

for (const width of [320, 390, 820, 1440, 2560]) test(`editorial project selection and Warkworth at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width >= 1200 ? 711 : 844 });
  await page.goto('/projects');
  const cards = page.locator('[data-project-card]');
  await expect(cards).toHaveCount(15);
  await page.goto('/projects/warkworth-outdoor-room');
  const article = page.locator('[data-project-case-study="warkworth-outdoor-room"]');
  await expect(article.locator('h1')).toHaveText('Warkworth Outdoor Room');
  const openingAction = article.getByRole('link', { name: /Discuss a similar project/ }).first();
  await expect(openingAction).toBeInViewport();
  for (const selector of ['h1', '#project-story p', '[data-project-decision] p', '#project-details']) {
    const boxes = await article.locator(selector).evaluateAll(elements => elements.map(el => ({ x: el.getBoundingClientRect().x, right: el.getBoundingClientRect().right })));
    for (const box of boxes) { expect(box.x).toBeGreaterThanOrEqual(19); expect(box.right).toBeLessThanOrEqual(width - 19); }
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await openingAction.click();
  await expect(page).toHaveURL(/\/contact\?/);
  expect(new URL(page.url()).searchParams.get('source_project')).toBe('warkworth-outdoor-room');
  await expect(page.locator('input[type="tel"]')).toHaveAttribute('required', '');
  await page.goBack();
  await expect(article.locator('h1')).toHaveText('Warkworth Outdoor Room');
  await article.getByText('Materials, finishes and project scope', { exact: true }).click();
  await expect(article.getByText('Engineering PS1 provided', { exact: false })).toBeVisible();
  const gallery = article.locator('[data-responsive-gallery]');
  await gallery.getByRole('button', { name: /Next image/ }).click();
  await expect(gallery).toHaveAttribute('data-gallery-position', '2/3');
  await article.locator('[data-related-projects] a').first().click();
  await expect(page.locator('h1')).not.toHaveText('Warkworth Outdoor Room');
  await page.goBack();
  await expect(article.locator('h1')).toHaveText('Warkworth Outdoor Room');
});

for (const width of [320, 1440]) test(`lower-card collection scroll survives return at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 720 });
  await page.goto('/projects?audience=residential&form=gable');
  await expect(page.locator('[data-project-card]')).toHaveCount(4);
  const card = width === 320 ? page.locator('[data-project-card="dairy-flat-estate"]') : page.locator('[data-project-card]').last();
  const title = await card.locator('h2').innerText();
  await card.scrollIntoViewIfNeeded();
  const position = () => page.evaluate(() => Math.max(window.scrollY, document.body.scrollTop));
  const before = await position();
  expect(before).toBeGreaterThan(100);
  await card.click();
  await expect(page.locator('h1')).toHaveText(title);
  await page.locator('[data-all-projects]').click();
  await expect(page.locator('[data-project-card]')).toHaveCount(4);
  await expect.poll(position).toBeCloseTo(before, 0);
  await expect(card).toBeInViewport();
  await card.click();
  await page.goBack();
  await expect(page.locator('[data-project-card]')).toHaveCount(4);
  await expect.poll(position).toBeCloseTo(before, 0);
});

for (const width of [390, 1440, 2560]) test(`Dairy Flat and St Heliers connected stories at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  for (const [slug, title, photoCount] of [['dairy-flat-estate', 'Dairy Flat Estate', 3], ['st-heliers-townhouse', 'St Heliers Townhouse', 2]] as const) {
    await page.goto('/projects/' + slug);
    const article = page.locator('[data-photographic-project]');
    await expect(article.locator('h1')).toHaveText(title);
    await expect(article.locator('.project-case-study__hero img, [data-project-decision] img')).toHaveCount(photoCount);
    await expect(article.locator('#project-details')).toContainText(slug === 'dairy-flat-estate' ? '28.4' : '18.0');
    const action = article.getByRole('link', { name: /Discuss a similar project/ }).first();
    await expect(action).toBeInViewport();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await action.click();
    expect(new URL(page.url()).searchParams.get('source_project')).toBe(slug);
    await expect(page.locator('input[type="tel"]')).toHaveAttribute('required', '');
    await page.goBack();
    await expect(article.locator('h1')).toHaveText(title);
    if (slug === 'st-heliers-townhouse') {
      await expect(article).toContainText('does not reproduce this project’s opal tint');
      await article.getByRole('link', { name: 'Start with this roof shape and size' }).click();
      await expect(page).toHaveURL(/configurator-preview.*source_project=st-heliers-townhouse.*#design=/);
      await page.goBack();
      await expect(article.locator('h1')).toHaveText(title);
    }
    await article.locator('[data-related-projects] a').first().click();
    await expect(page.locator('h1')).not.toHaveText(title);
    await page.goBack();
    await expect(article.locator('h1')).toHaveText(title);
    await page.locator('[data-project-next]').click();
    await expect(page.locator('h1')).not.toHaveText(title);
    await page.goBack();
    await expect(article.locator('h1')).toHaveText(title);
  }
});

for (const slug of ['lilliput-mini-golf', 'velskov-forest']) test(`commercial project context and return: ${slug}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/projects/${slug}?project_direction=outdoor-room`);
  const article = page.locator('[data-photographic-project]');
  const title = await article.locator('h1').innerText();
  await article.getByRole('link', { name: /Discuss a similar project/ }).first().click();
  await expect(page).toHaveURL(/\/contact\?/);
  const destination = new URL(page.url());
  expect(destination.searchParams.get('source_project')).toBe(slug);
  expect(destination.searchParams.get('enquiry_type')).toBe('commercial');
  await expect(page.locator('input[type="tel"]')).toHaveAttribute('required', '');
  await page.goBack();
  await expect(article.locator('h1')).toHaveText(title);
  await article.locator('[data-related-projects] a').first().click();
  await expect(page.locator('h1')).not.toHaveText(title);
  await page.goBack();
  await expect(article.locator('h1')).toHaveText(title);
  await page.locator('[data-project-next]').click();
  await expect(page.locator('h1')).not.toHaveText(title);
  await page.goBack();
  await expect(article.locator('h1')).toHaveText(title);
});
