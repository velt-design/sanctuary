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
  await expect(page.getByRole('button',{name:'Under roof view',exact:true})).toHaveCount(0);
  const camera=JSON.parse((await page.locator('canvas').getAttribute('data-camera'))!);
  expect(camera.projection).toBe('perspective');
  expect(camera.fov).toBe(24);
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

for (const width of [390, 1440]) test('box projection limits keep the model visible at ' + width, async ({page}) => {
  await page.setViewportSize({width,height:844});
  await page.goto('/configurator-preview');
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  await page.getByRole('button',{name:'Design your pergola',exact:false}).click();
  const projection = page.getByRole('textbox',{name:'Projection in metres',exact:true});
  const range = page.getByRole('slider',{name:'Projection',exact:true});
  await projection.fill('6.0'); await projection.press('Enter');
  await page.getByRole('radio',{name:'Solid',exact:true}).check();
  await page.getByRole('radio',{name:'Box perimeter',exact:true}).check();
  for (const [profile, metres, mm] of [['Corrugated','4.1','4100'],['Trapezoidal','3.9','3900'],['Tray','3.2','3200']]) {
    await page.getByRole('radio',{name:profile,exact:true}).check();
    await expect(projection).toHaveValue(metres);
    await expect(range).toHaveAttribute('max',mm);
    await expect(page.getByText('Projection adjusted to ' + metres + ' m for this roof.',{exact:true})).toBeVisible();
    await expect(page.locator('[data-geometry-status]')).toHaveAttribute('data-geometry-status','review_required');
    await expect(page.locator('canvas')).toHaveAttribute('data-camera',/perspective/);
  }
  await projection.fill('5.0'); await projection.press('Enter');
  await expect(projection).toHaveValue('3.2');
  await range.focus(); await range.press('End'); await range.press('ArrowRight');
  await expect(range).toHaveValue('3200');
  await page.getByRole('radio',{name:'Acrylic',exact:true}).check();
  await expect(range).toHaveAttribute('max','6000');
  await expect(projection).toHaveValue('3.2');
  await page.getByRole('radio',{name:'Solid',exact:true}).check();
  await page.reload();
  await page.getByRole('button',{name:'Design your pergola',exact:false}).click();
  await expect(projection).toHaveValue('3.2');
  await expect(range).toHaveAttribute('max','3200');
});
