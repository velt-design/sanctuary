import { expect, test } from '@playwright/test';
const project = '/projects/warkworth-outdoor-room';
const product = '/products/pergolas/gable';
for (const width of [360,390,768,1440]) for (const route of [project,product]) {
  test('Editorial pilot ' + route + ' at ' + width, async ({ page }) => {
    await page.route('**/api/enquiry', route => route.abort());
    await page.setViewportSize({ width, height:900 });
    await page.goto(route);
    const consent = page.getByRole('button', { name:'Essential only' });
    if (await consent.isVisible()) await consent.click();
    const main=page.locator('main[data-editorial-page]');
    await expect(main).toBeVisible();
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.sanctuarypergolas.co.nz' + route);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(route===product) {
      await page.getByRole('radio',{name:/03 Combination/}).check();
      await page.reload();
      await expect(page.getByRole('radio',{name:/03 Combination/})).toBeChecked();
      await page.getByRole('button',{name:'Next image in Gable pergola project gallery'}).click();
      await expect(main).toContainText('Image 2 of 2');
    } else {
      const summary=main.locator('dl').first();
      const cells=await summary.locator(':scope > div').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right};}));
      expect(Math.abs(cells[1].x-cells[0].right)).toBeLessThan(1);
      const disclosure=main.locator('[data-project-mobile-disclosure="facts"]');
      if(await disclosure.count() && !await disclosure.getAttribute('open') && width<641) await disclosure.locator('summary').click();
      if(width<641) await expect(main.locator('.project-case-study__facts')).toHaveCSS('padding-top','0px');
      await expect(main.locator('.project-case-study__gallery-section')).toContainText('Cedar and daylight');
    }
    await main.locator('h1').scrollIntoViewIfNeeded();
    await page.screenshot({path:'artifacts/marketing-foundation-evolution/pilot-'+(route===project?'project':'product')+'-'+width+'.png'});
    const cta=main.getByRole('link',{name:'Send project brief',exact:true}).last();
    await cta.click();
    await expect(page).toHaveURL(/\/contact\?/);
    const context=new URL(page.url()).searchParams;
    expect(context.get('source_path')).toBe(route);
    expect(context.get(route===project?'source_project':'source_product')).toBe(route===project?'warkworth-outdoor-room':'gable');
    await page.goBack();
    await expect(main).toBeVisible();
    if(route===product) await expect(page.getByRole('radio',{name:/03 Combination/})).toBeChecked();
  });
}
test('quiet motion applies across the page families', async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(product);
  await expect(page.locator('[data-editorial-hero-media]')).toHaveCSS('animation-duration','0s');
  await page.goto('/products/pergolas/pitched');
  await expect(page.locator('[data-editorial-page]')).toHaveCount(1);
  await page.goto('/projects/dairy-flat-estate');
  await expect(page.locator('[data-editorial-page]')).toHaveCount(1);
});

test('pilot roof information remains available without JavaScript', async ({browser, baseURL}) => {
  const context = await browser.newContext({javaScriptEnabled:false, viewport:{width:390,height:844}});
  const page = await context.newPage();
  await page.goto(baseURL + product);
  await expect(page.getByRole('heading',{name:'Gable pergola',exact:true})).toBeVisible();
  await expect(page.getByText(/^Combination: Solid and acrylic roof zones/)).toBeVisible();
  await expect(page.getByRole('radio',{name:/03 Combination/})).toBeHidden();
  await context.close();
});
