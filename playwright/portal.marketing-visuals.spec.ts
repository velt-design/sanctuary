import { test, expect } from '@playwright/test';

const fixture='/qa/marketing-performance-fixture';
async function ready(page: import('@playwright/test').Page) {
  await expect(page.locator('#hub-results')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#hub-record-count')).toBeVisible();
}
test('sales buckets reconcile, keyboard drill-through retains dates and Back context',async({page})=>{
  await page.goto(`${fixture}?view=sales`);await ready(page);
  const trend=page.getByRole('region',{name:'Quote activity trend'});
  await expect(trend).toBeVisible();
  const before=await trend.boundingBox();
  await page.getByLabel('Group sales by').selectOption('week');
  await expect(page).toHaveURL(/salesBucket=week/);
  const after=await trend.boundingBox();expect(after?.height).toBe(before?.height);expect(after?.y).toBe(before?.y);
  await page.getByText('View trend figures',{exact:true}).click();
  const week=page.getByRole('row').filter({hasText:'2026-09-01 – 2026-09-06'});
  await expect(week).toContainText('partial period');
  await week.getByRole('button',{name:'2',exact:true}).press('Enter');await ready(page);
  await expect(page.locator('#hub-record-count')).toHaveText('2 recorded events match · Quote version sent');
  await expect(page).toHaveURL(/start=2026-09-01/);await expect(page).toHaveURL(/end=2026-09-06/);
  const record=page.getByRole('region',{name:'Underlying hub records'}).getByRole('link').first();
  await record.scrollIntoViewIfNeeded();const y=await page.evaluate(()=>window.scrollY);
  await record.click();await expect(page.getByText('Underlying sample record',{exact:true})).toBeVisible();
  await page.goBack();await ready(page);
  await expect(page.getByLabel('Group sales by')).toHaveValue('week');
  await expect(page.getByLabel('Sales events to inspect')).toHaveValue('quote_sent');
  expect(Math.abs(await page.evaluate(()=>window.scrollY)-y)).toBeLessThan(80);
  await page.reload();await ready(page);await expect(page.getByLabel('Group sales by')).toHaveValue('week');
});
test('source cells count origin projects rather than repeated submissions and expose unknowns',async({page})=>{
  await page.goto(`${fixture}?view=enquiries`);await ready(page);
  const matrix=page.getByRole('region',{name:'Source and outcome comparison'});
  await expect(matrix).toContainText('Unknown / unattributed');
  await expect(matrix.getByRole('row').filter({hasText:'meta'})).toContainText('4 / 12');
  await matrix.getByRole('button',{name:'Inspect Accepted-scope projects from meta: 1',exact:true}).press('Enter');
  await expect(page.locator('#hub-record-count')).toContainText('1 submissions match');
  await expect(page.getByRole('region',{name:'Underlying hub records'})).toContainText('Sample poolside');
  await expect(page).toHaveURL(/source=meta/);await expect(page).toHaveURL(/inspect=accepted/);
});
test('payments and reversals are the receipt drill population, preserving source filters',async({page})=>{
  await page.goto(`${fixture}?view=sales&source=Unknown+%2F+unattributed`);await ready(page);
  await page.getByText('View trend figures',{exact:true}).click();
  await page.getByRole('button',{name:'$0.00 · 2 entries',exact:true}).click();await ready(page);
  await expect(page.locator('#hub-record-count')).toContainText('2 recorded events match · Payments and reversals');
  await expect(page).toHaveURL(/source=Unknown/);
  await expect(page.getByRole('region',{name:'Underlying hub records'})).toContainText('Payment reversed');
});
test('weekly choice survives saved view restore and failed reads do not show stale chart totals',async({page})=>{
  await page.goto(`${fixture}?view=sales&salesBucket=week`);await ready(page);
  await page.getByRole('button',{name:'Saved views',exact:true}).click();
  await page.getByLabel('View name').fill('Weekly sales review');
  await page.getByRole('button',{name:'Save this view',exact:true}).click();
  await page.getByLabel('Group sales by').selectOption('month');
  await page.getByRole('button',{name:'Saved views',exact:true}).click();
  await page.getByRole('button',{name:'Weekly sales review',exact:true}).click();
  await expect(page.getByLabel('Group sales by')).toHaveValue('week');
  await page.goto(`${fixture}?view=sales&failure=1`);
  await expect(page.getByText('Hub unavailable',{exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Quote activity trend'})).toHaveCount(0);
});
test('mobile and reduced-motion charts contain overflow and remain keyboard inspectable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`${fixture}?view=enquiries`);await ready(page);
  const matrix=page.getByRole('region',{name:'Source and outcome comparison'});
  await matrix.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await matrix.getByRole('button',{name:'Inspect Payment-verified projects from google: 1',exact:true}).press('Enter');
  await expect(page.locator('#hub-record-count')).toContainText('1 submissions match');
  await page.getByRole('tab',{name:'Sales activity',exact:true}).click();await ready(page);
  await expect(page.getByRole('region',{name:'Quote activity trend'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
