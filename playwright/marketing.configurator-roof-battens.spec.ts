import {test,expect} from '@playwright/test';
for(const width of [390,1440])test('roof battens profiles, materials, views and saved enquiry at '+width,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/configurator-preview');
  await page.getByRole('button',{name:'Essential only',exact:true}).click();await page.getByRole('button',{name:'Design your pergola',exact:false}).click();
  await page.getByRole('button',{name:'Roof & ceiling',exact:true}).click();
  const c=page.getByRole('region',{name:'Roof timber battens'});
  await c.getByRole('checkbox',{name:'Timber battens under rafters'}).check();
  const profile=c.getByRole('combobox',{name:'Roof batten profile'}),gap=c.getByRole('textbox',{name:'Roof batten gap in millimetres'});
  await profile.selectOption('65x39');await c.getByRole('radio',{name:'On edge',exact:true}).check();await expect(gap).toHaveValue('80');
  await gap.click();expect(await gap.evaluate(e=>(e as HTMLInputElement).selectionEnd!-(e as HTMLInputElement).selectionStart!)).toBe(2);
  await gap.fill('27');await gap.press('Enter');await expect(c.getByRole('slider',{name:'Roof batten clear gap'})).toHaveValue('27');
  await page.getByRole('button',{name:'Plan',exact:true}).click();expect(await page.locator('[data-roof-batten]').count()).toBeGreaterThan(10);
  for(const name of ['Gable','Box perimeter','Pitched']){
    await page.getByRole('button',{name:'Structure',exact:true}).click();await page.getByRole('radio',{name,exact:true}).check();await page.getByRole('button',{name:'Roof & ceiling',exact:true}).click();expect(await page.locator('[data-roof-batten]').count()).toBeGreaterThan(10);
    await expect(gap).toHaveValue('27');
  }
  await page.getByRole('radio',{name:'Combination',exact:true}).check();expect(await page.locator('[data-roof-batten]').count()).toBeGreaterThan(10);
  await page.getByRole('button',{name:'3D',exact:true}).click();await expect(page.locator('canvas')).toHaveAttribute('data-camera',/perspective/);
  await page.screenshot({path:'artifacts/configurator-preview/roof-battens-'+width+'.png'});
  await page.reload();await page.getByRole('button',{name:'Design your pergola',exact:false}).click();await page.getByRole('button',{name:'Roof & ceiling',exact:true}).click();await expect(gap).toHaveValue('27');
  await page.getByRole('link',{name:'Continue with this design',exact:true}).click();await page.getByText('Details',{exact:true}).click();
  await expect(page.getByText(/Under-rafter timber battens:.*27 mm clear gap/).last()).toBeVisible();
  await page.getByRole('button',{name:'Roof & ceiling',exact:true}).click();await page.getByRole('radio',{name:'Solid',exact:true}).check();await expect(c).toHaveCount(0);
  await page.getByRole('radio',{name:'Acrylic',exact:true}).check();await expect(c.getByRole('checkbox',{name:'Timber battens under rafters'})).not.toBeChecked();
});
