import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/simple-cover-price', route => route.fulfill({ json: { ok: false, status: 'unavailable' } }));
  await page.goto('/configurator-preview');
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  await page.getByRole('button', { name: 'Design your pergola', exact: false }).click();
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await expect(page.locator('[data-family]')).toHaveAttribute('data-geometry-status', 'review_required');
});

test('gable orientation and infills share Plan and 3D while Simple pricing stays separate', async ({ page }) => {
  const viewport = page.locator('[data-family]');
  await expect(viewport).toHaveAttribute('data-infill-support-count', '0');
  await expect(page.getByRole('checkbox', { name: 'Gable infills', exact: true })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Gable infills', exact: true }).check();
  await expect(viewport).toHaveAttribute('data-infill-support-count', /[1-9]/);
  let priceCalls=0;
  page.on('request', request => { if(request.url().includes('/api/simple-cover-price')) priceCalls++; });
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('7.2');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  const ridge=page.locator('svg [data-member-id="ridge"]');
  expect(await ridge.getAttribute('y1')).toBe(await ridge.getAttribute('y2'));
  await page.getByRole('radio', { name: 'Away from house', exact: true }).check();
  await expect(viewport).toHaveAttribute('data-ridge-direction','away');
  expect(Number(await ridge.getAttribute('x1'))).toBeCloseTo(Number(await ridge.getAttribute('x2')),4);
  await expect(page.locator('svg [data-member-id$="king-post-strut"]')).toHaveCount(1);
  await expect(page.getByRole('radio',{name:'Soffit brackets',exact:true})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Estimated price'})).toContainText('Gable pricing will be confirmed');
  await page.waitForTimeout(300);
  expect(priceCalls).toBe(0);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('radio',{name:'Pitched',exact:true}).check();
  await expect(viewport).toHaveAttribute('data-family','mono');
  await expect(page.getByRole('region',{name:'Estimated price'})).toContainText('YOUR SIMPLE PERGOLA');
});

test('parallel gable retains the soffit limit and selected camera across resizing', async ({ page }) => {
  await page.getByRole('radio',{name:'Soffit brackets',exact:true}).check();
  const canvas=page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-camera', /position/);
  const box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width*.45,box.y+box.height*.5);
  await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5,{steps:15});await page.mouse.up();
  const camera=JSON.parse((await canvas.getAttribute('data-camera'))!);
  await page.getByRole('textbox',{name:'Projection in metres'}).fill('4.1');
  await page.getByRole('textbox',{name:'Projection in metres'}).press('Enter');
  await expect(page.getByRole('radio',{name:'Soffit brackets',exact:true})).toBeDisabled();
  await expect(page.getByRole('radio',{name:'Fascia',exact:true})).toBeChecked();
  const after=JSON.parse((await canvas.getAttribute('data-camera'))!);
  expect(after.zoom).toBeCloseTo(camera.zoom,6);
  camera.position.forEach((value:number,i:number)=>expect(after.position[i]-after.target[i]).toBeCloseTo(value-camera.target[i],4));
});

test('mobile gable choices and Plan remain usable', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('radio',{name:'Away from house',exact:true}).check();
  await page.getByRole('checkbox',{name:'Gable infills',exact:true}).check();
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await expect(page.getByRole('img',{name:/Pergola plan/})).toBeVisible();
  await page.getByRole('textbox',{name:'Projection in metres'}).fill('5.0');
  await page.getByRole('textbox',{name:'Projection in metres'}).press('Enter');
  await expect(page.getByRole('img',{name:/5.0 m projection/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('gable Plan posts become 150mm only above 20 square metres', async ({ page }) => {
  await page.getByRole('textbox',{name:'Width in metres'}).fill('5.0');
  await page.getByRole('textbox',{name:'Width in metres'}).press('Enter');
  await page.getByRole('textbox',{name:'Projection in metres'}).fill('4.0');
  await page.getByRole('textbox',{name:'Projection in metres'}).press('Enter');
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await expect(page.locator('svg rect[data-member-id^="gable-front-post-"]').first()).toHaveAttribute('width','90');
  await page.getByRole('textbox',{name:'Projection in metres'}).fill('4.1');
  await page.getByRole('textbox',{name:'Projection in metres'}).press('Enter');
  await expect(page.locator('svg rect[data-member-id^="gable-front-post-"]').first()).toHaveAttribute('width','150');
  await page.getByRole('radio',{name:'Away from house',exact:true}).check();
  await expect(page.locator('svg rect[data-member-id^="gable-left-post-"]').first()).toHaveAttribute('width','150');
  await page.getByRole('textbox',{name:'Projection in metres'}).fill('4.0');
  await page.getByRole('textbox',{name:'Projection in metres'}).press('Enter');
  await expect(page.locator('svg rect[data-member-id^="gable-left-post-"]').first()).toHaveAttribute('width','90');
});

test('gable support and flashing thresholds update together in Plan', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const setSize = async (name: string, value: string) => {
    const input = page.getByRole('textbox', { name });
    await input.fill(value); await input.press('Enter');
  };
  await setSize('Width in metres', '4.0');
  await setSize('Projection in metres', '3.0');
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.locator('svg rect[data-member-id^="gable-front-post-"]')).toHaveCount(2);
  await setSize('Width in metres', '4.1');
  await expect(page.locator('svg rect[data-member-id^="gable-front-post-"]')).toHaveCount(3);
  await setSize('Width in metres', '4.0');
  await setSize('Projection in metres', '4.9');
  await expect(page.locator('svg rect[data-member-id$="king-post-strut"]')).toHaveCount(0);
  await setSize('Projection in metres', '5.0');
  await expect(page.locator('svg rect[data-member-id$="king-post-strut"]')).toHaveCount(2);
  await expect(page.locator('svg rect[data-member-id$="king-post-strut"]').first()).toHaveAttribute('width', '150');
  await expect(page.locator('svg rect[data-member-id$="king-post-strut"]').first()).toHaveAttribute('height', '50');
  await expect(page.locator('svg [data-ridge-flashing]')).toHaveAttribute('data-ridge-flashing', '150');
  await setSize('Width in metres', '4.1');
  await expect(page.locator('svg [data-ridge-flashing]')).toHaveAttribute('data-ridge-flashing', '150');
  await expect(page.locator('svg [data-ridge-flashing] polygon')).toHaveCount(2);
  await page.getByRole('radio', { name: 'Away from house', exact: true }).check();
  await setSize('Width in metres', '5.0');
  await setSize('Projection in metres', '4.0');
  await expect(page.locator('svg rect[data-member-id^="gable-left-post-"]')).toHaveCount(1);
  await expect(page.locator('svg rect[data-member-id$="king-post-strut"]')).toHaveCount(1);
  await expect(page.locator('svg rect[data-member-id$="king-post-strut"]')).toHaveAttribute('width', '50');
  await expect(page.locator('svg rect[data-member-id$="king-post-strut"]')).toHaveAttribute('height', '150');
  await setSize('Projection in metres', '4.1');
  await expect(page.locator('svg rect[data-member-id^="gable-left-post-"]')).toHaveCount(2);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
