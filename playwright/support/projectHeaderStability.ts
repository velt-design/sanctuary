import { expect, test, type Page } from '@playwright/test';

export function registerProjectHeaderStabilityTests(fixturePath: string, expectNoOverflow: (page: Page) => Promise<void>) {
  for (const width of [2560, 1440, 895, 390]) {
    test(`project header targets remain stable through refresh and retry at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${fixturePath}?tab=estimates&workdesk=1&snapshotState=summary`);
      const masthead = page.locator('[data-project-masthead-slot]');
      const projects = masthead.getByRole('link', { name: 'Projects', exact: true });
      await expect(masthead.getByRole('button', { name: 'Updating project', exact: true })).toBeVisible();
      await projects.focus();
      const controls = [projects, ...['Estimates', 'Quotes', 'Invoices'].map(name =>
        page.getByRole('tablist', { name: 'Commercial sections' }).getByRole('tab', { name, exact: true }))];
      for (const control of controls) await expect(control).toBeVisible();
      const before = await Promise.all(controls.map(control => control.boundingBox()));
      expect(before.every(Boolean)).toBe(true);
      for (const transition of ['refresh-failed', 'retry', 'summary', 'fresh', 'refresh-failed', 'fresh']) {
        const state = transition === 'retry' ? 'fresh' : transition;
        if (transition === 'retry') {
          await masthead.getByRole('button', { name: 'Retry', exact: true }).click();
        } else {
          await page.evaluate((nextState) => {
            const url = new URL(location.href);
            url.searchParams.set('snapshotState', nextState);
            history.replaceState(null, '', url);
          }, state);
        }
        if (state === 'fresh') {
          await expect(masthead.getByRole('button', { name: 'Project current', exact: true })).toBeVisible();
        } else {
          const feedback = masthead.getByRole('button', { name: state === 'summary' ? 'Updating project' : 'Showing saved project details', exact: true });
          await expect(feedback).toBeVisible();
          if (state === 'refresh-failed') {
            await feedback.click();
            await expect(page.getByRole('dialog')).toContainText('The latest refresh failed');
            await page.keyboard.press('Escape');
            await expect(feedback).toBeFocused();
          }
        }
        // Extend the actual Commercial content owner, so its sticky toolbar has
        // the same containing block as ordinary long records, not a short sibling.
        await page.evaluate((fresh) => {
          let tail = document.getElementById('geometry-fixture-tail');
          const commercial = document.querySelector('[data-project-commercial-view]');
          if (!commercial) throw new Error('The actual Commercial content owner is missing.');
          if (!tail) { tail = document.createElement('div'); tail.id = 'geometry-fixture-tail'; commercial.append(tail); }
          tail.style.height = fresh ? '1200px' : '0px';
        }, state === 'fresh');
        const work = page.locator('[data-project-workspace-scroll="true"]');
        if (state === 'fresh') {
          await work.hover();
          await page.mouse.wheel(0, 300);
          await expect.poll(() => work.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
        }
        expect(await page.evaluate(() => scrollY)).toBe(0);
        expect(await page.evaluate(() => ({ body: document.body.scrollTop, document: document.documentElement.scrollTop, scrollingElement: document.scrollingElement?.scrollTop ?? 0 }))).toEqual({ body: 0, document: 0, scrollingElement: 0 });
        for (const [index, control] of controls.entries()) {
          const after = await control.boundingBox();
          expect(after).not.toBeNull();
          expect(Math.abs(after!.x - before[index]!.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(after!.y - before[index]!.y)).toBeLessThanOrEqual(1);
        }
        await expectNoOverflow(page);
      }
      await expect(projects).toHaveAttribute('href', '/staff/projects');
      const work = page.locator('[data-project-workspace-scroll="true"]');
      const saved = await work.evaluate(element => element.scrollTop);
      expect(saved).toBeGreaterThan(0);
      await page.getByRole('tab', { name: 'Files', exact: true }).click();
      await expect(page).toHaveURL(/tab=files/);
      await page.evaluate(() => document.getElementById('geometry-fixture-tail')?.remove());
      await expect.poll(() => work.evaluate(element => element.scrollTop)).toBe(0);
      await page.goBack();
      await expect(page).toHaveURL(/tab=estimates/);
      // Reintroduce controlled long content after native history adoption. This
      // exercises late restoration without putting filler into the product.
      await page.locator('[data-project-commercial-view]').evaluate(element => {
        const tail = document.createElement('div'); tail.id = 'geometry-fixture-tail'; tail.style.height = '1200px'; element.append(tail);
      });
      await expect.poll(async () => Math.abs(await work.evaluate(element => element.scrollTop) - saved)).toBeLessThanOrEqual(1);
      await page.goForward();
      await expect(page).toHaveURL(/tab=files/);
      await page.evaluate(() => document.getElementById('geometry-fixture-tail')?.remove());
      await expect.poll(() => work.evaluate(element => element.scrollTop)).toBe(0);
      for (const [index, control] of controls.entries()) {
        // Commercial sections are absent on Files; the persistent Projects link
        // remains the same physical return target through both history steps.
        if (index > 0) continue;
        const after = await control.boundingBox();
        expect(Math.abs(after!.x - before[index]!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(after!.y - before[index]!.y)).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => scrollY)).toBe(0);
    });
  }
}
