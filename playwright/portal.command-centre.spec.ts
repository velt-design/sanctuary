import { expect, test } from '@playwright/test';

const FIXTURE_PATH = '/qa/project-command-centre-fixture';

const SCENARIOS = [
  ['new-lead', '$1,234.56 inc GST'],
  ['no-current-design', 'No current design'],
  ['standard-estimate', '$1,234.56 inc GST'],
  ['multiple-estimates', '6m x 4m + 2 more'],
  ['sent-revision', 'Quote sent'],
  ['accepted-newer-estimate', 'newer unrelated estimate'],
  ['declined-quote', 'Latest quote outcome: declined'],
  ['missing-source', 'Source design unavailable'],
  ['missing-price', 'Price unavailable'],
] as const;

for (const [scenario, expected] of SCENARIOS) {
  test(`renders truthful ${scenario} command-centre state`, async ({ page }) => {
    await page.goto(`${FIXTURE_PATH}?scenario=${scenario}`);
    const fixture = page.locator('[data-portal-qa-fixture="project-command-centre"]');
    await expect(fixture).toHaveAttribute('data-fixture-scenario', scenario);
    await expect(fixture).toContainText(expected);
    await expect(fixture.locator('[data-command-centre-source]')).toBeVisible();
  });
}

test('keeps the command-centre card readable at a 390px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${FIXTURE_PATH}?scenario=accepted-newer-estimate`);
  const fixture = page.locator('[data-portal-qa-fixture="project-command-centre"]');
  await expect(fixture).toContainText('Quote accepted');
  await expect(fixture).toContainText('newer unrelated estimate');
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(horizontalOverflow).toBe(false);
});
