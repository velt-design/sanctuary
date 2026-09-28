import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({
    analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1,
  })));
  // Never send an enquiry or load a vendor while verifying preview navigation.
  await page.route(/\/api\/(enquiry|contact)(?:\?|$)/, route => route.abort());
  await page.route(/google-analytics|googletagmanager|facebook\.net|clarity\.ms/, route => route.abort());
});

for (const width of [320, 390, 820, 1024, 1100, 1101, 1440]) {
  test(`complete challenger remains readable and navigable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/configurator-price', route => route.fulfill({ json: { status: 'priced', amountIncGst: 23829, breakdown: [] } }));
    await page.goto('/');
    await expect(page.locator('[data-homepage-composition="architecture-first"]')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.sanctuarypergolas.co.nz');
    await page.getByRole('link', { name: 'Find your pergola', exact: true }).click();
    for (const type of ['pitched', 'gable', 'box-perimeter']) {
      const card = page.locator(`[data-product-type="${type}"]`);
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('img')).toBeVisible();
      await expect.poll(() => card.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(card.locator('h3 a')).toHaveAttribute('href', `/products/pergolas/${type}`);
      await expect(card.getByText('Including installation', { exact: true })).toBeVisible();
      const rows = card.locator('[data-price-example]');
      await expect(rows).toHaveCount(3);
      for (const [index, widthMm] of [3000, 6000, 9000].entries()) {
        const row = rows.nth(index);
        await expect(row).toHaveAttribute('data-price-example', String(widthMm));
        const dimensionSize = await row.locator('dt').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
        expect(dimensionSize).toBeGreaterThanOrEqual(16);
        expect(await row.evaluate(e => getComputedStyle(e).borderBottomWidth)).toBe(width > 1100 ? (index === 2 ? '2px' : '1px') : '0px');
        await expect(row.locator('[data-priced]')).toBeVisible();
        expect(await row.locator('[data-priced]').evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
        const bounds = await row.evaluate(e => ({ cell: e.getBoundingClientRect().right, text: e.querySelector('[data-priced]')!.getBoundingClientRect().right }));
        expect(bounds.text).toBeLessThanOrEqual(bounds.cell + 1);
      }
      const positions = await rows.evaluateAll(elements => elements.map(e => ({ x: e.getBoundingClientRect().x, y: e.getBoundingClientRect().y })));
      if (width > 1100) {
        expect(positions[1].y).toBeGreaterThan(positions[0].y);
        expect(positions[2].y).toBeGreaterThan(positions[1].y);
        expect(Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x))).toBeLessThan(1);
      } else {
        expect(positions[1].x).toBeGreaterThan(positions[0].x);
        expect(positions[2].x).toBeGreaterThan(positions[1].x);
        expect(Math.max(...positions.map(p => p.y)) - Math.min(...positions.map(p => p.y))).toBeLessThan(1);
      }
      expect(await card.locator('dl').evaluate(e => getComputedStyle(e).borderBottomWidth)).toBe(width > 1100 ? '0px' : '1px');
      const image = await card.locator('img').boundingBox();
      const heading = await card.locator('h3').boundingBox();
      const strip = await card.locator('dl').boundingBox();
      expect(heading!.y + heading!.height).toBeLessThanOrEqual(image!.y);
      expect(image!.y + image!.height).toBeLessThanOrEqual(strip!.y + 1);
    }
    await expect(page.getByText('Installed estimates include GST. Subject to site confirmation.', { exact: false })).toBeVisible();
    await page.getByText('Estimate details & illustrations').click();
    await expect(page.getByText(/Product links preserve your saved choices/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore this project' })).toHaveAttribute('href', '/projects/warkworth-outdoor-room');
    await expect(page.getByRole('link', { name: 'Discuss your project' })).toHaveAttribute('href', /enquiry_type=residential/);
    await expect(page.getByRole('link', { name: 'Discuss your project' })).toHaveAttribute('href', /source_component=final_cta/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (width < 760) expect(await page.getByText('Installed estimates include GST.', { exact: false }).evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);
    else {
      const color = await page.locator('header .nav-cta').evaluate(e => getComputedStyle(e).color);
      expect(color).not.toBe('rgb(255, 255, 255)');
    }
  });
}

test('selected and restored professional enquiries retain their audience through every new entry', async ({ page, browser }, testInfo) => {
  await page.goto('/');
  await page.locator('button[data-project-direction="commercial-professional"]').click();
  await page.locator('button[data-professional-path="architects-designers"]').click();
  const hero = page.getByRole('link', { name: 'Enquire about your space' });
  await expect(hero).toHaveAttribute('href', /enquiry_type=professional/);
  await expect(hero).toHaveAttribute('href', /project_professional_path=architects-designers/);
  await expect(page.getByRole('link', { name: 'Discuss your project' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'The whole space. Every detail.' })).toHaveCount(0);
  const restoredURL = page.url();
  await page.reload();
  await expect(hero).toHaveAttribute('href', /enquiry_type=professional/);
  await hero.click();
  await expect(page).toHaveURL(/enquiry_type=professional/);
  await page.goBack();
  await expect(hero).toHaveAttribute('href', /project_professional_path=architects-designers/);
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    extraHTTPHeaders: testInfo.project.use.extraHTTPHeaders,
  });
  const initial = await noJs.newPage();
  await initial.goto(restoredURL);
  await expect(initial.getByRole('link', { name: 'Enquire about your space' })).toHaveAttribute('href', /enquiry_type=professional/);
  await noJs.close();
  await page.getByRole('button', { name: 'Start again', exact: true }).click();
  await expect(hero).toHaveAttribute('href', /enquiry_type=residential/);
  await expect(hero).not.toHaveAttribute('href', /project_professional_path/);
  await expect(page.getByRole('link', { name: 'Discuss your project' })).toHaveAttribute('href', /enquiry_type=residential/);
});

test('legacy and bespoke saved priorities survive reload, Back and reset', async ({ page }) => {
  for (const direction of ['cover', 'bespoke']) {
    await page.goto(`/?project=${direction}&priorities=daylight`);
    await expect(page.locator('[data-project-finder-result]')).toHaveAttribute('data-project-finder-result', direction);
    await expect(page.locator('[data-project-priority="daylight"]')).toBeChecked();
    const hero = page.getByRole('link', { name: 'Enquire about your space' });
    await expect(hero).toHaveAttribute('href', /project_priorities=daylight/);
    await page.reload();
    await expect(page.locator('[data-project-priority="daylight"]')).toBeChecked();
    await hero.click();
    await expect(page).toHaveURL(/\/contact\?/);
    await page.goBack();
    await expect(hero).toHaveAttribute('href', new RegExp(`project_direction=${direction}`));
    await page.getByRole('button', { name: 'Start again', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Discuss your project' })).toBeVisible();
    await expect(hero).not.toHaveAttribute('href', /project_priorities/);
  }
});

for (const width of [320, 820, 1024, 1100, 1101]) {
test(`nine size-price pairs load and recover without moving the comparison at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  let recover = false;
  const requests: string[] = [];
  let release!: () => void;
  const loading = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/configurator-price', async route => {
    const { input, roof } = route.request().postDataJSON();
    requests.push(`${roof.family}:${input.widthMm}:${input.projectionMm}`);
    await loading;
    await route.fulfill({ json: recover
      ? { status: 'priced', amountIncGst: input.widthMm + 5000, breakdown: [] }
      : { status: 'unavailable' } });
  });
  await page.goto('/');
  const first = page.locator('[data-product-type="pitched"] [data-price-example="3000"]');
  await expect(page.getByText('Updating…', { exact: true })).toHaveCount(9);
  await expect.poll(() => requests.length).toBe(9);
  expect(new Set(requests).size).toBe(9);
  const next = page.locator('[data-product-type="gable"]');
  const before = await next.evaluate(element => element.getBoundingClientRect().top + window.scrollY);
  const compare = page.getByRole('link', { name: 'Compare pergolas', exact: true });
  const compareBefore = await compare.evaluate(element => element.getBoundingClientRect().top + window.scrollY);
  release();
  await expect(page.getByRole('button', { name: /estimate unavailable. Retry/ })).toHaveCount(9);
  await expect(page.locator('[data-priced="true"]')).toHaveCount(0);
  expect(Math.abs(await next.evaluate(element => element.getBoundingClientRect().top + window.scrollY) - before)).toBeLessThan(2);
  recover = true;
  await first.getByRole('button', { name: 'Pitched 3 × 3 m estimate unavailable. Retry' }).click();
  await expect(first.locator('[data-priced="true"]')).toHaveText('≈ Approximately $8,000');
  await expect(page.getByRole('button', { name: /estimate unavailable. Retry/ })).toHaveCount(8);
  for (const row of await page.locator('[data-price-example]').all()) {
    if (await row.getByRole('button').count()) await row.getByRole('button').click();
  }
  await expect(page.locator('[data-priced="true"]')).toHaveCount(9);
  for (const type of ['pitched', 'gable', 'box-perimeter']) {
    for (const [width, price] of [[3000, '≈ Approximately $8,000'], [6000, '≈ Approximately $11,000'], [9000, '≈ Approximately $14,000']] as const) {
      const row = page.locator(`[data-product-type="${type}"] [data-price-example="${width}"]`);
      await expect(row.locator('dt')).toHaveText(`${width / 1000} × 3 m`);
      await expect(row.locator('[data-priced="true"]')).toHaveText(price);
    }
  }
  const after = await next.evaluate(element => element.getBoundingClientRect().top + window.scrollY);
  expect(Math.abs(after - before)).toBeLessThan(2);
  expect(Math.abs(await compare.evaluate(element => element.getBoundingClientRect().top + window.scrollY) - compareBefore)).toBeLessThan(2);
  expect(requests).toHaveLength(18);
});
}

test('roofline entry preserves a saved product size rather than applying an example', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('sanctuary:pitched-product:v1', JSON.stringify({ widthMm: 7400, projectionMm: 3000, material: 'acrylic', sides: 'open', orientation: 'parallel' })));
  await page.goto('/');
  await page.locator('[data-product-type="pitched"] h3 a').click();
  await expect(page).toHaveURL(/\/products\/pergolas\/pitched/);
  await expect(page.getByRole('textbox', { name: /width/i })).toHaveValue('7.4');
  await page.goBack();
  await expect(page.locator('[data-product-type="pitched"] [data-price-example]')).toHaveCount(3);
});

for (const marketing of [false, true]) {
  test(`homepage campaign enquiry preserves consent and retry with marketing ${marketing}`, async ({ page, baseURL }) => {
    await page.addInitScript(enabled => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: enabled, updatedAt: new Date().toISOString(), version: 1 })), marketing);
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.fallback() : route.abort());
    const payloads: Array<Record<string, any>> = [];
    await page.route('**/api/enquiry', async route => {
      payloads.push(route.request().postDataJSON());
      await route.fulfill({ status: payloads.length === 1 ? 503 : 200, json: payloads.length === 1 ? { ok: false, error: 'Enquiry service unavailable' } : { ok: true } });
    });
    await page.goto('/?utm_source=meta&utm_medium=paid_social&utm_campaign=synthetic-homepage&secret=discard');
    await page.getByRole('link', { name: 'Enquire about your space' }).click();
    await page.getByRole('radio', { name: 'Bespoke design', exact: false }).check();
    await page.getByLabel('Name Required').fill('Synthetic homepage test');
    await page.getByLabel('Phone Required').fill('021 000 0000');
    await page.getByLabel('Email Required').fill('homepage@example.test');
    await page.getByRole('button', { name: 'Send custom project brief' }).click();
    await expect(page.locator('.contact-form__submit-error')).toContainText('Enquiry service unavailable');
    await expect(page.getByLabel('Name Required')).toHaveValue('Synthetic homepage test');
    await page.getByRole('button', { name: 'Send custom project brief' }).click();
    await expect(page.getByRole('status')).toContainText('Project brief sent.');
    expect(payloads).toHaveLength(2);
    expect(payloads[0].submissionId).toBe(payloads[1].submissionId);
    expect(payloads[1].attribution.utm).toEqual(marketing ? { utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'synthetic-homepage' } : {});
    expect(payloads[1].attribution.consent.marketing).toBe(marketing);
    expect(payloads[1].enquiryContext).toMatchObject({ source_path: '/', source_component: 'hero', source_experience: 'project-finder-home-v1' });
    expect(JSON.stringify(payloads[1].attribution)).not.toMatch(/secret|discard/);
  });
}

for (const analytics of [false, true]) {
  test(`homepage actions retain existing analytics only with consent ${analytics}`, async ({ page }) => {
    await page.addInitScript(enabled => {
      localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: enabled, marketing: false, updatedAt: new Date().toISOString(), version: 1 }));
      window.dataLayer = [];
    }, analytics);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Enquire about your space' })).toHaveAttribute('data-enquiry-type', 'residential');
    if (analytics) await expect.poll(() => page.evaluate(() => window.dataLayer?.some(entry => !Array.isArray(entry) && entry.event === 'project_finder_home_view'))).toBe(true);
    await page.evaluate(() => document.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('a[data-project-finder-event]')) event.preventDefault();
    }, true));
    for (const name of ['Find your pergola', 'Enquire about your space', 'Discuss your project']) await page.getByRole('link', { name, exact: true }).click();
    const readActions = () => page.evaluate(() => (window.dataLayer ?? []).filter(entry => !Array.isArray(entry) && ['project_finder_start_click', 'project_finder_direct_enquiry_click'].includes(String(entry.event))));
    expect(await readActions()).toEqual(analytics ? [
      expect.objectContaining({ event: 'project_finder_start_click', source_component: 'hero', step_number: 1 }),
      expect.objectContaining({ event: 'project_finder_direct_enquiry_click', source_component: 'hero', enquiry_type: 'residential' }),
      expect.objectContaining({ event: 'project_finder_direct_enquiry_click', source_component: 'final_cta', enquiry_type: 'residential' }),
    ] : []);
    await page.locator('button[data-project-direction="commercial-professional"]').click();
    await page.locator('button[data-professional-path="architects-designers"]').click();
    const enquiry = page.getByRole('link', { name: 'Enquire about your space' });
    await expect(enquiry).toHaveAttribute('data-enquiry-type', 'professional');
    await enquiry.click();
    const actions = await readActions();
    if (analytics) expect(actions.at(-1)).toMatchObject({ event: 'project_finder_direct_enquiry_click', enquiry_type: 'professional', source_component: 'hero' });
    else expect(actions).toEqual([]);
  });
}
