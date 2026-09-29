import { expect, test, type Page } from '@playwright/test';
import { products } from '../apps/marketing/data/products';
import { writeFileSync } from 'node:fs';
import { COMPARISON_SIZES } from '../apps/marketing/components/products/productComparisonTable';

async function prepare(page: Page) {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
  await page.route(/google-analytics|googletagmanager|facebook\.com/, route => route.abort());
  await page.route(/\/api\/(enquiry|contact)(?:\?|$)/, route => route.abort());
}

for (const width of [320, 390, 820, 1100, 1440]) test(`overview compares all rooflines accessibly at ${width}`, async ({ page }) => {
  await prepare(page); await page.setViewportSize({ width, height: 900 });
  await page.goto('/products');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pergolas.');
  const cards = page.locator('[data-product-form-grid] > article');
  await expect(cards).toHaveCount(3);
  await expect(cards.locator('[data-priced]')).toHaveCount(3);
  for (const card of await cards.all()) {
    await expect(card.getByText('Including installation', { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: /^Explore / })).toHaveAttribute('href', /\/products\/pergolas\//);
  }
  const radios = page.getByRole('radio');
  await expect(radios).toHaveCount(6);
  expect(await radios.evaluateAll(es => es.map(e => e.parentElement!.textContent))).toEqual(['2 \u00d7 3 m','4 \u00d7 3 m','6 \u00d7 3 m','8 \u00d7 3 m','6 \u00d7 4 m','6 \u00d7 5 m']);
  await expect(page.getByRole('radio', { name: '6 \u00d7 3 m', exact: true })).toBeChecked();
  await expect(page.getByRole('group', { name: 'Width \u00d7 projection' })).toBeVisible();
  const positions = await radios.evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(positions).size).toBe(width <= 760 ? 2 : 1);
  for (const radio of await radios.all()) {
    const box = await radio.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  if (width <= 760) {
    const overview = page.getByRole('navigation', { name: 'Explore the three rooflines' });
    await expect(overview.getByRole('link')).toHaveCount(3);
    expect((await overview.boundingBox())!.y + (await overview.boundingBox())!.height).toBeLessThan(650);
    await overview.getByRole('link', { name: /Box/ }).click();
    await expect(page.locator('#compare-box-perimeter h2')).toBeInViewport();
    await expect(page.locator('#compare-pitched')).toBeVisible();
  } else {
    const positions = await cards.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(2);
    if (width === 1440) for (const link of await cards.getByRole('link').all()) { const box = (await link.boundingBox())!; expect(box.y + box.height).toBeLessThanOrEqual(900); }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('loaded comparison switches all six sizes atomically offline without requests', async ({ page, context }) => {
  await prepare(page); let priceRequests=0;
  page.on('request', request => { if(request.url().includes('/api/configurator-price')) priceRequests++; });
  await page.goto('/products'); const cards=page.locator('[data-product-form-grid]');
  await expect(cards.locator('[data-priced]')).toHaveCount(3);
  expect(priceRequests).toBe(0);
  const expected = new Map<string,string[]>();
  for(const [width,projection] of COMPARISON_SIZES) {
    await page.getByRole('radio',{name:`${width/1000} \u00d7 ${projection/1000} m`,exact:true}).check();
    expected.set(`${width}-${projection}`,await cards.locator('[data-priced]').allTextContents());
  }
  let requests=0; page.on('request',()=>requests++); await context.setOffline(true);
  for(const [width,projection] of [...COMPARISON_SIZES].reverse()) {
    await page.getByRole('radio',{name:`${width/1000} \u00d7 ${projection/1000} m`,exact:true}).check();
    // Immediate DOM read, with no response wait or polling allowance.
    expect(await cards.locator('[data-priced]').allTextContents()).toEqual(expected.get(`${width}-${projection}`));
    expect(await cards.locator(`[data-example-width="${width}"][data-example-projection="${projection}"]`).count()).toBe(3);
    expect(await cards.getByText('Updating estimate',{exact:true}).count()).toBe(0);
  }
  expect(requests).toBe(0); expect(priceRequests).toBe(0);
  await page.getByRole('radio',{name:'6 \u00d7 5 m',exact:true}).focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio',{name:'6 \u00d7 4 m',exact:true})).toBeChecked();
});

const publicationFixture=process.env.MARKETING_COMPARISON_PUBLICATION_FIXTURE;
test('streamed fallback and resolved controls cannot uncheck each other', async ({ browser }) => {
  test.skip(!publicationFixture,'Requires the private local publication-fetch fixture.');
  writeFileSync(publicationFixture!,'delay');
  const context=await browser.newContext({javaScriptEnabled:false,baseURL:process.env.MARKETING_BASE_URL});
  try {
    const page=await context.newPage(); await page.goto('/products');
    const radios=await page.locator('input[type="radio"]').evaluateAll(es=>es.map(element=>{
      const input=element as HTMLInputElement; return {name:input.name,value:input.value,checked:input.checked};
    }));
    expect(radios).toHaveLength(12); // Visible fallback plus the not-yet-revealed streamed content.
    const groups=[...new Set(radios.map(input=>input.name))]; expect(groups).toHaveLength(2);
    for(const name of groups) expect(radios.filter(input=>input.name===name&&input.checked).map(input=>input.value)).toEqual(['6000-3000']);
  } finally {await context.close();writeFileSync(publicationFixture!,'normal');}
});
for (const width of [320,820,1440]) test(`initial comparison failure and whole-table recovery stay stable at ${width}`, async ({ page }) => {
  test.skip(!publicationFixture,'Requires the private local publication-fetch fixture; never enabled on hosted deployments.');
  await prepare(page); await page.setViewportSize({width,height:1000});
  writeFileSync(publicationFixture!,'fail');
  try {
    await page.goto('/products'); const cards=page.locator('[data-product-form-grid]');
    await expect(cards.getByText('Estimate unavailable',{exact:true})).toHaveCount(3);
    await expect(page.getByRole('radio').first()).toBeDisabled();
    const before=await cards.getByRole('link').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top+scrollY));
    writeFileSync(publicationFixture!,'delay'); await page.getByRole('button',{name:'Retry estimates',exact:true}).click();
    await expect(cards.getByText('Updating estimate',{exact:true})).toHaveCount(3);
    await expect(cards.locator('[data-priced]')).toHaveCount(3);
    await expect(page.getByRole('radio').first()).toBeEnabled();
    await expect(page.getByRole('radio',{name:'6 \u00d7 3 m',exact:true})).toBeChecked();
    const after=await cards.getByRole('link').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top+scrollY));
    after.forEach((top,index)=>expect(Math.abs(top-before[index])).toBeLessThanOrEqual(2));
  } finally { writeFileSync(publicationFixture!,'normal'); }
});

test('delayed initial publication shows coherent disabled loading before all prices arrive',async({page})=>{
  test.skip(!publicationFixture,'Requires the private local publication-fetch fixture.');
  await prepare(page); writeFileSync(publicationFixture!,'delay');
  try {
    await page.goto('/products',{waitUntil:'commit'});
    await expect(page.locator('[data-product-form-grid]').getByText('Updating estimate',{exact:true})).toHaveCount(3);
    await expect(page.getByRole('radio').first()).toBeDisabled();
    await expect(page.locator('[data-product-form-grid] [data-priced]')).toHaveCount(3);
    await expect(page.getByRole('radio').first()).toBeEnabled();
    await expect(page.getByRole('radio',{name:'6 \u00d7 3 m',exact:true})).toBeChecked();
  } finally {writeFileSync(publicationFixture!,'normal');}
});

test('overview preserves saved product choice and support routes', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => sessionStorage.setItem('sanctuary:pitched-product:v1', JSON.stringify({ widthMm: 4900, projectionMm: 3000, material: 'acrylic', sides: 'open', orientation: 'parallel' })));
  await page.goto('/products');
  await page.getByRole('radio', { name: '6 × 5 m', exact: true }).check();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary:pitched-product:v1')!).widthMm)).toBe(4900);
  await page.getByRole('link', { name: 'Explore Pitched', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('4.9');
  await page.goBack(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pergolas.');
  for (const product of products.filter(product => product.categorySlug !== 'pergolas')) {
    await expect(page.locator(`[data-product-option-gateway] a[href="${product.route}"]`)).toHaveCount(1);
  }
  await expect(page.getByRole('link', { name: /^Discuss a bespoke design/ })).toHaveAttribute('href', /enquiry_intent=bespoke/);
  await expect(page.locator('a[href="/pergola-cost-auckland"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.sanctuarypergolas.co.nz/products');
  await page.getByText('Comparison details', { exact: false }).first().click();
  await expect(page.getByRole('table', { name: 'Pergola form comparison' })).toBeVisible();
});
