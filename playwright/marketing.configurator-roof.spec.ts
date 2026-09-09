import { test, expect } from '@playwright/test';

for (const width of [360, 390, 1440]) test('roof profiles, bays and enquiry stay in sync at ' + width, async ({page}) => {
  await page.setViewportSize({width,height:844});
  await page.goto('/configurator-preview');
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  await page.getByRole('button',{name:'Design your pergola',exact:false}).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera',/position/);
  await page.getByRole('radio',{name:'Gable',exact:true}).check();
  await page.getByRole('radio',{name:'Away from house',exact:true}).check();
  await page.getByRole('radio',{name:'Combination',exact:true}).check();
  const viewport=page.locator('[data-roof-material]');
  await expect(viewport).toHaveAttribute('data-roof-material','combination');
  await expect(viewport).toHaveAttribute('data-geometry-status','review_required');
  for(const name of ['Trapezoidal','Tray','Corrugated']) {
    await page.getByRole('radio',{name,exact:true}).check();
    await expect(viewport).toHaveAttribute('data-roof-profile',name.toLowerCase());
    await expect(viewport).toHaveAttribute('data-geometry-status','review_required');
  }
  await page.getByRole('radio',{name:'Tray',exact:true}).check();
  await page.getByRole('radio',{name:'500 mm',exact:true}).check();
  await page.getByRole('radio',{name:'House-side band',exact:true}).check();
  await page.getByRole('button',{name:'Remove acrylic bay',exact:true}).click();
  await expect(viewport).toHaveAttribute('data-acrylic-bays','1');
  const underside = page.getByRole('button',{name:'Under roof view',exact:true});
  expect((await underside.boundingBox())!.x).toBeGreaterThanOrEqual(0);
  const expand = page.getByRole('button',{name:'Expand view',exact:true});
  if(width < 600) { const box = (await expand.boundingBox())!; expect(box.x + box.width).toBeLessThanOrEqual(width); }
  await underside.click();
  const camera=await page.locator('canvas').getAttribute('data-camera');
  await page.screenshot({path:'artifacts/configurator-preview/roof-under-'+width+'.png'});
  await page.getByRole('button',{name:'Add acrylic bay',exact:true}).click();
  await expect(viewport).toHaveAttribute('data-acrylic-bays','2');
  expect(await page.locator('canvas').getAttribute('data-camera')).not.toBeNull();
  expect(camera).not.toBeNull();
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await page.screenshot({path:'artifacts/configurator-preview/roof-above-'+width+'.png'});
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await expect(page.locator('[data-roof-region="solid"]')).toHaveCount(2);
  await page.getByRole('radio',{name:'Parallel to house',exact:true}).check();
  await expect(page.getByRole('radio',{name:'House-side band',exact:true})).toHaveCount(0);
  await expect(page.getByRole('radio',{name:'Central band',exact:true})).toBeChecked();
  await page.getByRole('link',{name:'Continue with this design',exact:true}).click();
  await page.getByText('Details',{exact:true}).click();
  await expect(page.getByText(/Tray 500 mm.*Cedar ceiling.*Central skylight/).last()).toBeVisible();
  await expect(page.locator('input[name="roofMaterials"][value="timber"]')).toHaveCount(1);
  await expect(page.locator('input[name="roofMaterials"][value="acrylic"]')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('radio',{name:'Combination',exact:true})).toBeChecked();
  await expect(page.getByRole('radio',{name:'500 mm',exact:true})).toBeChecked();
});
