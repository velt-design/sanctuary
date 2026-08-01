import { expect, test, type Locator, type Page } from '@playwright/test';

const FIXTURE_PATH = '/qa/project-work-queue-fixture';

const viewports = [
  { label: 'wide desktop', width: 1440, height: 900 },
  { label: 'compact desktop', width: 1024, height: 768 },
  { label: 'tablet', width: 768, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
] as const;

const groupHeadings = ['Overdue', 'Today', 'Next 7 business days', 'Blocked', 'Needs triage'] as const;

async function expectNoDocumentOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

async function expectVisibleFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  const focusStyle = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  const hasOutline = focusStyle.outlineStyle !== 'none' && focusStyle.outlineWidth !== '0px';
  const hasShadow = focusStyle.boxShadow !== 'none';
  expect(hasOutline || hasShadow).toBe(true);
}

test.describe.configure({ mode: 'serial' });

for (const viewport of viewports) {
  test(`keeps every operational group readable at ${viewport.label}`, async ({ page }) => {
    const staffRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/staff/')) staffRequests.push(request.url());
    });
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto(FIXTURE_PATH);

    const fixture = page.locator('[data-portal-qa-fixture="project-work-queue"]');
    await expect(fixture).toBeVisible();
    await expect(fixture.locator('[data-project-work-queue-fixture-hydrated="true"]')).toBeAttached();
    await expect(page.getByRole('heading', { level: 1, name: 'Work Queue' })).toBeVisible();

    for (const heading of groupHeadings) {
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
    }

    await expect(fixture.getByText('Harbour Courtyard Canopy')).toBeVisible();
    await expect(fixture.getByText('Ridgeview Pergola')).toBeVisible();
    await expect(fixture.getByText('Kauri Lane Shelter')).toBeVisible();
    await expect(fixture.getByText('Estuary Outdoor Room')).toBeVisible();
    await expect(fixture.getByText('Northern Courtyard Cover')).toBeVisible();
    await expect(fixture.getByRole('link', { name: 'Ridgeview Pergola' })).toHaveAttribute(
      'href',
      '/staff/projects/proj_fixture_queue_today?tab=activity',
    );
    await expect(fixture.getByRole('link', { name: 'Arrange site visit' })).toHaveAttribute(
      'href',
      '/staff/schedule?view=site-visits&project=proj_fixture_queue_today',
    );
    await expect(fixture.getByText('Open workspace', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Review exact list' }).click();
    const staleDialog = page.getByRole('dialog', { name: 'Review stale enquiries' });
    await expect(staleDialog).toBeVisible();
    await expect(staleDialog.getByText('Kate - Titirangi')).toBeVisible();
    await expect(staleDialog.getByText('Phillip Maddren - Whangarei')).toBeVisible();
    await expect(staleDialog.getByText('Protected future follow-up')).toBeVisible();
    const candidateChecks = staleDialog.getByRole('checkbox');
    await expect(candidateChecks).toHaveCount(3);
    await expect(candidateChecks.nth(0)).not.toBeChecked();
    await expect(candidateChecks.nth(1)).not.toBeChecked();
    await expect(candidateChecks.nth(2)).toBeDisabled();
    await expect(
      staleDialog.getByRole('button', { name: 'Review selected (0)' }),
    ).toBeDisabled();
    await staleDialog.getByText('Kate - Titirangi', { exact: true }).click();
    await expect(candidateChecks.nth(0)).toBeChecked();
    await staleDialog.getByRole('button', { name: 'Review selected (1)' }).click();
    const confirmDialog = page.getByRole('dialog', { name: 'Confirm 1 stale enquiry' });
    await expect(confirmDialog.getByText('Kate - Titirangi')).toBeVisible();
    await expect(
      confirmDialog.getByRole('button', { name: 'Close 1 as Lost - No response' }),
    ).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Cancel' }).click();

    if (viewport.label === 'mobile') {
      const blockedRow = fixture.locator('[data-queue-group="blocked"]');
      await blockedRow.getByText('Manage work').click();
      await expect(blockedRow.getByRole('button', { name: 'Unblock' })).toBeVisible();
    }

    await expectNoDocumentOverflow(page);
    expect(staffRequests).toEqual([]);
  });
}

test('preserves keyboard order and visible focus across project and action controls', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(FIXTURE_PATH);

  await page.keyboard.press('Tab');
  await expectVisibleFocus(page.getByRole('button', { name: 'Review exact list' }));

  await page.keyboard.press('Tab');
  const firstProject = page.getByRole('link', {
    name: 'Harbour Courtyard Canopy',
  });
  await expectVisibleFocus(firstProject);

  await page.keyboard.press('Tab');
  await expectVisibleFocus(page.getByRole('button', { name: 'Email sent' }));

  await page.keyboard.press('Tab');
  await expectVisibleFocus(page.getByRole('button', { name: 'Customer replied' }));
});

test('reflows at 200% zoom without creating document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 500 });
  await page.goto(FIXTURE_PATH);
  await expect(page.locator('[data-project-work-queue-fixture-hydrated="true"]')).toBeAttached();
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });

  await expect(page.getByRole('heading', { level: 1, name: 'Work Queue' })).toBeVisible();
  for (const heading of groupHeadings) {
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
  }
  const blockedRow = page.locator('[data-queue-group="blocked"]');
  await blockedRow.getByText('Manage work').click();
  await expect(blockedRow.getByRole('button', { name: 'Unblock' })).toBeVisible();
  await expectNoDocumentOverflow(page);
});
