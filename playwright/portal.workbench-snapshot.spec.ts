/*
 * Workbench visual snapshot spec.
 *
 * Purpose: capture the current rendered state of the design workbench
 * while iterating on CSS / layout / density changes. Output PNGs land
 * in `tmp/` so the next iteration (human or AI) can read them back.
 *
 * Usage:
 *   npx playwright test playwright/portal.workbench-snapshot.spec.ts \
 *     --project=portal-fixture --reporter=line
 *
 * The portal-fixture project (playwright.config.ts) auto-spawns a Next
 * dev server with `ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1` on
 * port 3011 and runs against http://127.0.0.1:3011.
 *
 * Navigates directly to /qa/design-workbench-fixture which does not
 * require auth and (after PR-T5) mounts the full workbench shell —
 * left rail (VISIBILITY + OBJECTS TREE) + canvas + right inspector
 * (`WorkbenchInspectorHost` with no-op action stubs). All four
 * inspector families render correctly when the corresponding rail row
 * is clicked.
 *
 * This is NOT a regression test. The screenshots are the artifact.
 */

import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

const SNAPSHOT_OUTPUT_DIR = path.resolve(process.cwd(), 'tmp');

async function gotoFixture(page: Page, fixtureSlug: string) {
  await page.goto(`/qa/design-workbench-fixture?fixture=${encodeURIComponent(fixtureSlug)}`);
  await expect(page.locator('[data-workbench-fixture]').first()).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

async function switchToPlanEditor(page: Page) {
  const tab = page.getByRole('tab', { name: 'Plan Editor' }).first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(400);
  }
}

async function selectFirstRowOfFamily(page: Page, family: string) {
  // Rail rows carry `data-workbench-object-button="<family>:<id>"`.
  // Click the first one that matches the requested family so the
  // inspector mounts the corresponding family-specific editor.
  const row = page.locator(`[data-workbench-object-button^="${family}:"]`).first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(600);
  }
}

test.describe('workbench snapshot', () => {
  test.beforeAll(async () => {
    await mkdir(SNAPSHOT_OUTPUT_DIR, { recursive: true });
  });

  test('mono-standard — plan editor + pergola selected', async ({ page }) => {
    await gotoFixture(page, 'mono-standard');
    await switchToPlanEditor(page);
    await selectFirstRowOfFamily(page, 'pergolas');
    await page.screenshot({
      path: path.join(SNAPSHOT_OUTPUT_DIR, 'workbench-mono-pergola.png'),
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('mono-standard — plan editor + house form selected', async ({ page }) => {
    await gotoFixture(page, 'mono-standard');
    await switchToPlanEditor(page);
    await selectFirstRowOfFamily(page, 'house_forms');
    await page.screenshot({
      path: path.join(SNAPSHOT_OUTPUT_DIR, 'workbench-mono-house-form.png'),
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('mono-standard — 3D review with nothing selected', async ({ page }) => {
    await gotoFixture(page, 'mono-standard');
    await page.screenshot({
      path: path.join(SNAPSHOT_OUTPUT_DIR, 'workbench-mono-3d-empty.png'),
      fullPage: false,
      animations: 'disabled',
    });
  });
});
