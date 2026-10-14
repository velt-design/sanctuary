import { expect, test } from '@playwright/test';
import { INITIAL_PRODUCT_SELECTION } from '../apps/marketing/components/products/productSelectionValues';
import { lookupLandingPrice, parseLandingPriceTable } from '../apps/marketing/lib/landingPriceTable';
import { formatEstimate } from '../apps/marketing/lib/estimateDisplay';

// Real published-price integration: the default development runner has no generated approved table.
test.skip(!process.env.MARKETING_BASE_URL, 'Requires an explicitly selected built marketing server with approved published pricing.');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, version: 1, updatedAt: new Date().toISOString() })));
});

for (const path of ['/pergola-cost-auckland', '/pergolas-auckland']) for (const width of [390, 1440]) {
  test(`exact preloaded price survives blocked preparation and price requests: ${path} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const responsePromise = page.waitForResponse('**/api/landing-price-table');
    const started = Date.now(); await page.goto(path);
    const response = await responsePromise, body = await response.json(), table = parseLandingPriceTable(body.table);
    expect(body.status).toBe('ready'); expect(table).not.toBeNull();
    const estimate = page.locator('#explore-options [data-estimate-state]');
    await expect(estimate).toHaveAttribute('data-estimate-state', 'priced');
    await expect(page.getByRole('link', { name: 'Enquire about this design', exact: true })).toBeVisible();
    const loadMs = Date.now() - started;
    // Both ordinary per-change requests are held until the test releases them. No response can provide the new price.
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/pergola-selection', async route => { await gate; await route.abort(); });
    await page.route('**/api/configurator-price', async route => { await gate; await route.abort(); });
    await page.evaluate(() => {
      const win = window as unknown as { estimateStates: string[]; estimateLatencies: number[]; editStarted: number };
      win.estimateStates = []; win.estimateLatencies = []; win.editStarted = 0;
      const section = document.querySelector('#explore-options')!;
      section.addEventListener('change', () => { win.editStarted = performance.now(); }, true);
      section.addEventListener('blur', () => { win.editStarted = performance.now(); }, true);
      new MutationObserver(() => {
        win.estimateStates.push(section.querySelector('[data-estimate-state]')?.getAttribute('data-estimate-state') ?? 'missing');
        if (win.editStarted) { win.estimateLatencies.push(performance.now() - win.editStarted); win.editStarted = 0; }
      }).observe(section.querySelector('[data-estimate-state]')!, { subtree: true, childList: true, characterData: true, attributes: true });
    });
    let selection = { ...INITIAL_PRODUCT_SELECTION };
    const check = async (type: 'pitched' | 'gable' | 'box-perimeter') => {
      const expected = lookupLandingPrice(table!, type, selection)!;
      await expect(estimate).toHaveAttribute('data-estimate-state', expected.status);
      await expect(estimate.locator('strong')).toHaveText(expected.status === 'priced' ? formatEstimate(expected.amountIncGst) : expected.status === 'issue' ? 'Check the projection' : 'Tailored quote');
    };
    try {
      await page.getByRole('radio', { name: 'Gable', exact: true }).check(); await check('gable');
      await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.3'); await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter'); selection.widthMm = 5300; await check('gable');
      await page.getByRole('textbox', { name: 'Projection in metres' }).fill('3.7'); await page.getByRole('textbox', { name: 'Projection in metres' }).press('Enter'); selection.projectionMm = 3700; await check('gable');
      await page.getByRole('radio', { name: 'Mixed + timber', exact: true }).check(); selection.material = 'combination'; await check('gable');
      await page.getByRole('radio', { name: 'Box', exact: true }).check(); await check('box-perimeter');
      await page.getByRole('radio', { name: 'Solid + timber', exact: true }).check(); selection.material = 'solid'; await check('box-perimeter');
      await page.getByRole('textbox', { name: 'Width in metres' }).fill('10'); await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter'); selection.widthMm = 10000; await check('box-perimeter');
      await page.getByRole('textbox', { name: 'Projection in metres' }).fill('6'); await page.getByRole('textbox', { name: 'Projection in metres' }).press('Enter'); selection.projectionMm = 6000; await check('box-perimeter');
      await page.getByRole('radio', { name: 'Acrylic', exact: true }).check(); selection.material = 'acrylic'; await check('box-perimeter');
      const evidence = await page.evaluate(() => ({ states: (window as unknown as { estimateStates: string[] }).estimateStates,
        renderLatencies: (window as unknown as { estimateLatencies: number[] }).estimateLatencies }));
      expect(evidence.states.length).toBeGreaterThan(5); expect(evidence.states).not.toContain('loading'); expect(evidence.states).not.toContain('missing');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await test.info().attach('table-timing', { contentType: 'application/json', body: JSON.stringify({ path, width, loadMs, versionNumber: table!.versionNumber, ...evidence }) });
    } finally { release(); }
    await page.unroute('**/api/pergola-selection'); await page.unroute('**/api/configurator-price');
    await page.getByRole('textbox', { name: 'Projection in metres' }).fill('3'); await page.getByRole('textbox', { name: 'Projection in metres' }).press('Enter');
    await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.3'); await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
    const enquiry = page.getByRole('link', { name: 'Enquire about this design', exact: true });
    await expect(enquiry).toHaveAttribute('href', new RegExp(`source_path=${encodeURIComponent(path)}`));
    await enquiry.click(); await expect(page).toHaveURL(/source_product=box-perimeter/);
    await expect(page.getByRole('link', { name: /Back to website/ })).toHaveAttribute('href', path);
  });
}

for (const path of ['/pergola-cost-auckland', '/pergolas-auckland']) test(`valid table keeps failed design-link preparation recoverable: ${path}`, async ({ page }) => {
  await page.route('**/api/pergola-selection', route => route.fulfill({ status: 503, json: {} }));
  await page.goto(path); const estimate = page.locator('#explore-options [data-estimate-state]');
  await expect(estimate).toHaveAttribute('data-estimate-state', 'priced');
  await expect(page.getByRole('button', { name: 'Retry options' })).toBeVisible();
  await page.unroute('**/api/pergola-selection'); await page.getByRole('button', { name: 'Retry options' }).click();
  await expect(page.getByRole('link', { name: 'Enquire about this design', exact: true })).toBeVisible();
  await expect(estimate).toHaveAttribute('data-estimate-state', 'priced');
});

for (const path of ['/pergola-cost-auckland', '/pergolas-auckland']) test(`full saved extras bypass the loaded basic table: ${path}`, async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sanctuary.pergolas-auckland-design.v1', JSON.stringify({ version: 1,
    input: { widthMm: 6000, projectionMm: 3000, level: 'ground', connection: 'fascia' }, roof: { family: 'gable', orientation: 'parallel', infills: true } })));
  let pricedDraft: { roof: { infills: boolean } } | undefined;
  await page.route('**/api/configurator-price', route => { pricedDraft = route.request().postDataJSON(); return route.fulfill({ json: { status: 'priced', amountIncGst: 89995 } }); });
  await page.goto(path); const estimate = page.locator('#explore-options [data-estimate-state]');
  await expect(estimate).toContainText('$89,995'); expect(pricedDraft?.roof.infills).toBe(true);
  await expect(page.getByRole('link', { name: 'Continue your design', exact: true })).toBeVisible();
});

test('full and conditional delivery use the artifact and revalidate the approved publication', async ({ request, baseURL }) => {
  const begin = Date.now();
  const cold = await request.post('/api/landing-price-table', { data: {}, headers: { Origin: baseURL! } });
  expect(cold.ok()).toBe(true); const body = await cold.json(), coldMs = Date.now() - begin;
  expect(body.status).toBe('ready'); expect(parseLandingPriceTable(body.table)).not.toBeNull();
  const warmStart = Date.now(); const warm = await request.post('/api/landing-price-table', { data: { knownId: body.table.id }, headers: { Origin: baseURL! } });
  expect(await warm.json()).toEqual({ status: 'current', id: body.table.id, leaseMs: 30000 });
  const warmMs = Date.now() - warmStart;
  expect(coldMs).toBeLessThan(15000); expect(warmMs).toBeLessThan(15000);
  await test.info().attach('artifact-delivery', { contentType: 'application/json', body: JSON.stringify({ coldMs, warmMs, jsonBytes: JSON.stringify(body).length }) });
});

test('approved staging table agrees with signed canonical prices across all roof and material combinations', async ({ request, baseURL }) => {
  const headers = { Origin: baseURL! };
  const response = await request.post('/api/landing-price-table', { data: {}, headers });
  const table = parseLandingPriceTable((await response.json()).table)!;
  expect(table).not.toBeNull();
  let checked = 0;
  for (const type of ['pitched', 'gable', 'box-perimeter'] as const) for (const material of ['acrylic', 'solid', 'combination'] as const) {
    const selection = { ...INITIAL_PRODUCT_SELECTION, widthMm: 5300, projectionMm: 2900, material };
    const prepared = await request.post('/api/pergola-selection', { data: { type, selection, sourcePath: '/pergola-cost-auckland' }, headers });
    const design = await prepared.json(); expect(design.issue).toBeNull();
    const canonical = await request.post('/api/configurator-price', { data: design.draft, headers });
    const price = await canonical.json(), cell = lookupLandingPrice(table, type, selection);
    expect(price.status).toBe('priced'); expect(cell).toEqual({ status: 'priced', amountIncGst: price.amountIncGst }); checked++;
  }
  await test.info().attach('staging-parity', { contentType: 'application/json', body: JSON.stringify({ checked, versionNumber: table.versionNumber, source: 'actual approved staging publication, read-only requests' }) });
});
