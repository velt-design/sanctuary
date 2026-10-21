import { expect, test, type Page } from '@playwright/test';

export function registerProjectHeaderStabilityTests(fixturePath: string, expectNoOverflow: (page: Page) => Promise<void>) {
  for (const width of [1440, 390]) {
    test(`project header targets remain stable through refresh and retry at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${fixturePath}?tab=estimates&snapshotState=summary`);
      const masthead = page.locator('[data-project-masthead-slot]');
      const projects = masthead.getByRole('link', { name: 'Projects', exact: true });
      await expect(page.getByText('Updating project', { exact: true })).toBeVisible();
      await projects.focus();
      const controls = [projects, ...['Estimates', 'Quotes', 'Invoices'].map(name =>
        page.getByRole('tablist', { name: 'Commercial sections' }).getByRole('tab', { name, exact: true }))];
      for (const control of controls) await expect(control).toBeVisible();
      const before = await Promise.all(controls.map(control => control.boundingBox()));
      expect(before.every(Boolean)).toBe(true);
      for (const state of ['refresh-failed', 'summary', 'fresh', 'refresh-failed', 'fresh']) {
        if (state === 'summary') {
          await page.getByRole('button', { name: 'Retry', exact: true }).click();
        } else {
          await page.evaluate((nextState) => {
            const url = new URL(location.href);
            url.searchParams.set('snapshotState', nextState);
            history.replaceState(null, '', url);
          }, state);
        }
        if (state === 'fresh') {
          await expect(page.getByText('Updating project', { exact: true })).toHaveCount(0);
          await expect(page.getByText('Showing saved project details', { exact: true })).toHaveCount(0);
        } else {
          await expect(page.getByText(state === 'summary' ? 'Updating project' : 'Showing saved project details', { exact: true })).toBeVisible();
        }
        // Force a real scrollbar transition independently of cached fixture lists.
        await page.evaluate((fresh) => {
          let tail = document.getElementById('geometry-fixture-tail');
          if (!tail) { tail = document.createElement('div'); tail.id = 'geometry-fixture-tail'; document.body.append(tail); }
          tail.style.height = fresh ? '1200px' : '0px';
        }, state === 'fresh');
        for (const [index, control] of controls.entries()) {
          const after = await control.boundingBox();
          expect(after).not.toBeNull();
          expect(Math.abs(after!.x - before[index]!.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(after!.y - before[index]!.y)).toBeLessThanOrEqual(1);
        }
        await expectNoOverflow(page);
      }
      await expect(projects).toHaveAttribute('href', '/staff/projects');
    });
  }
}
