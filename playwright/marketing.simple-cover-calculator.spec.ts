import { expect, test } from '@playwright/test';

const legacy = {schemaVersion:'simple-cover-handoff.v1',status:'priced',
  input:{widthMm:5400,projectionMm:3200,level:'ground',connection:'facade'},
  calculationRef:'sc1.old-reference',displayedPriceIncGst:999999,configurationVersion:2};

test('standalone bookmark migrates selections into the shared designer without reusing its old price', async ({page}) => {
  await page.addInitScript(value => sessionStorage.setItem('sanctuary.simple-cover-handoff.v1',JSON.stringify(value)),legacy);
  await page.goto('/simple-cover-calculator');
  await expect(page).toHaveURL(/\/contact\?.*configurator=preview/);
  expect(new URL(page.url()).searchParams.get('source_path')).toBe('/simple-cover-calculator');
  await expect(page.getByRole('textbox',{name:'Width in metres',exact:true})).toHaveValue('5.4');
  await expect(page.getByRole('textbox',{name:'Projection in metres',exact:true})).toHaveValue('3.2');
  await expect(page.locator('body')).not.toContainText('$999,999');
  await expect(page.locator('#contact-form input[name="requestType"]')).toHaveValue('site-measure');
});

test('a newer full design is not replaced by an old Simple handoff', async ({page}) => {
  await page.addInitScript(value => {
    sessionStorage.setItem('sanctuary.simple-cover-handoff.v1',JSON.stringify(value));
    sessionStorage.setItem('sanctuary.configurator-preview.v1',JSON.stringify({version:1,
      input:{...value.input,widthMm:6500},roof:{family:'gable',orientation:'parallel',infills:false}}));
  },legacy);
  await page.goto('/simple-cover-calculator');
  await expect(page.getByRole('textbox',{name:'Width in metres',exact:true})).toHaveValue('6.5');
  await expect(page.getByRole('radio',{name:'Gable',exact:true})).toBeChecked();
});
