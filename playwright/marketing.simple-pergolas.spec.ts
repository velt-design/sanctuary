import { expect, test } from '@playwright/test';

const route = '/simple-pergolas-auckland';
for (const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:1000}]) {
  test(`Simple product page opens the shared designer at ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto(route);
    await expect(page).toHaveTitle('Simple Pitched Acrylic Pergolas | Sanctuary Pergolas');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/simple-pergolas-auckland$/);
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/);
    await expect(page.locator('main form')).toHaveCount(0);
    await expect(page.locator('#price-your-cover')).toContainText('without entering contact details');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole('link',{name:'Design your pergola',exact:true}).first().click();
    await expect(page).toHaveURL(/\/contact\?.*configurator=preview/);
    expect(new URL(page.url()).searchParams.get('source_path')).toBe(route);
    await expect(page.getByRole('button',{name:'Structure',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Roof & ceiling',exact:true})).toBeVisible();
    await expect(page.locator('#contact-form input[name="requestType"]')).toHaveValue('site-measure');
  });
}

test('help and bespoke bypass the calculator while retaining source attribution', async ({page}) => {
  await page.goto(route);
  await page.getByRole('link',{name:/^Need help choosing\?/}).click();
  await expect(page.locator('#contact-form')).toHaveAttribute('data-contact-pathway','help');
  await expect(page.locator('#contact-simple-calculator')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('source_path')).toBe(route);
  await expect(page.locator('#contact-suburb')).not.toHaveAttribute('required');
  await page.goto(route);
  await page.getByRole('link',{name:/^Need a bespoke design\?/}).click();
  await expect(page.locator('#contact-form')).toHaveAttribute('data-contact-pathway','custom');
  await expect(page.locator('#contact-simple-calculator')).toHaveCount(0);
});

test('the old estimate anchor remains useful without JavaScript', async ({browser,baseURL}) => {
  const context = await browser.newContext({javaScriptEnabled:false,baseURL});
  try {
    const page = await context.newPage();
    await page.goto(`${route}#initial-estimate`);
    await expect(page.locator('#initial-estimate')).toContainText('does not book an appointment');
    await expect(page.locator('#initial-estimate').getByRole('link',{name:'Design your pergola',exact:true}))
      .toHaveAttribute('href', /configurator=preview/);
    await expect(page.getByRole('link',{name:/^Need help choosing\?/})).toHaveAttribute('href', /enquiry_intent=help/);
  } finally { await context.close(); }
});
